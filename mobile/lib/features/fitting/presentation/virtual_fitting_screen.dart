import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:camera/camera.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/features/fitting/domain/fitting_engine.dart';
import 'package:capricho_store/features/fitting/domain/fitting_telemetry.dart';
import 'package:capricho_store/features/fitting/domain/pose_smoother.dart';
import 'package:capricho_store/features/fitting/presentation/fitting_overlay_painter.dart';
import 'package:capricho_store/features/fitting/presentation/garment_ar_overlay.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:sensors_plus/sensors_plus.dart';

enum FittingStep {
  scanning,      // Paso 1: Escaneo activo con la cámara (3s)
  diagnosis,     // Paso 2: Tarjeta de diagnóstico y talla calculada
  activeFitting, // Paso 3: Vestidor interactivo en tiempo real
}

class VirtualFittingScreen extends ConsumerStatefulWidget {
  const VirtualFittingScreen({
    super.key,
    required this.product,
    required this.measurements,
    this.initialVariant,
    this.images = const [],
  });

  final Product product;
  final List<ProductMeasurement> measurements;
  final ProductVariant? initialVariant;
  final List<ProductImage> images;

  @override
  ConsumerState<VirtualFittingScreen> createState() =>
      _VirtualFittingScreenState();
}

class _VirtualFittingScreenState extends ConsumerState<VirtualFittingScreen>
    with SingleTickerProviderStateMixin {
  CameraController? _cameraController;
  List<CameraDescription> _cameras = [];
  int _currentCameraIndex = 0;
  bool _isCameraInitialized = false;
  bool _isFlashOn = false;
  bool _showGuides = true;

  // Telemetría de Vuelo (iPhone 15 Pro Max CoreMotion + Distancia)
  StreamSubscription<AccelerometerEvent>? _accelerometerSub;
  DeviceAngleState _angleState = DeviceAngleState.alignedDefault;
  UserDistanceState _distanceState = UserDistanceState.optimalDefault;
  bool _wasAngleAligned = true;

  // Máquina de estados del vestidor
  FittingStep _currentStep = FittingStep.scanning;

  // Animación del rayo láser de escaneo
  late AnimationController _scanAnimationController;
  late Animation<double> _scanAnimation;

  // Temporizador de calibración manual (3 segundos)
  Timer? _scanTimer;
  double _scanProgress = 0.0;
  int _scanSecondsRemaining = 3;

  // Parámetros de anatomía y calce (Hito 5.2)
  double _userShouldersCm = 44.0;
  late String _selectedGender;
  BodyBuild _selectedBodyBuild = BodyBuild.regular;
  final PoseSmoother _poseSmoother = PoseSmoother(alpha: 0.35);
  Offset _detectedNeck = const Offset(0.50, 0.34);
  double _detectedShoulderAngle = 0.0;
  double _detectedShoulderRatio = 0.45;

  late String _activeSize;
  late String _activeColor;
  late ProductVariant? _activeVariant;
  late FittingRecommendation _recommendation;

  @override
  void initState() {
    super.initState();
    final isWomenProduct =
        widget.product.audience.toUpperCase() == 'MUJER' ||
            widget.product.category.toUpperCase() == 'BLUSA';
    _selectedGender = isWomenProduct ? 'MUJER' : 'HOMBRE';
    _userShouldersCm = isWomenProduct ? 38.0 : 44.0;
    _initPrendaState();
    _initAnimation();
    _initSensors();
    _initCamera();
  }

  DateTime _lastAngleUpdate = DateTime.fromMillisecondsSinceEpoch(0);

  void _initSensors() {
    try {
      _accelerometerSub = accelerometerEventStream().listen(
        (event) {
          if (!mounted) return;
          // Si ya no está en escaneo, no consumir recursos de UI
          if (_currentStep != FittingStep.scanning) return;

          final now = DateTime.now();
          if (now.difference(_lastAngleUpdate).inMilliseconds < 90) {
            return; // Throttling a ~11 FPS para evitar congelar la interfaz
          }
          _lastAngleUpdate = now;

          final newAngle = DeviceAngleState.fromAccelerometer(
            x: event.x,
            y: event.y,
            z: event.z,
          );

          // Taptic Engine feedback al alcanzar 90° (vertical recto)
          if (newAngle.isVerticalAligned && !_wasAngleAligned) {
            HapticFeedback.selectionClick();
            _wasAngleAligned = true;
          } else if (!newAngle.isVerticalAligned) {
            _wasAngleAligned = false;
          }

          setState(() {
            _angleState = newAngle;
          });
        },
        onError: (e) {
          debugPrint('Error en acelerómetro CoreMotion: $e');
        },
      );
    } catch (e) {
      debugPrint('No se pudo inicializar stream de acelerómetro: $e');
    }
  }

  void _initAnimation() {
    _scanAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );

    _scanAnimation = Tween<double>(begin: 0.05, end: 0.95).animate(
      CurvedAnimation(
        parent: _scanAnimationController,
        curve: Curves.easeInOutSine,
      ),
    );

    _scanAnimationController.repeat(reverse: true);
  }

  static const _poseChannel = MethodChannel('com.capricho.store/body_pose');
  bool _isAnalyzingPose = false;
  String? _poseDetectionError;

  void _startScanSequence() {
    if (_isAnalyzingPose) return;
    _scanTimer?.cancel();
    _scanAnimationController.repeat(reverse: true);
    setState(() {
      _currentStep = FittingStep.scanning;
      _scanProgress = 0.0;
      _scanSecondsRemaining = 3;
      _poseDetectionError = null;
    });

    const tickDuration = Duration(milliseconds: 100);
    const totalDurationMs = 3000;
    int elapsedMs = 0;

    _scanTimer = Timer.periodic(tickDuration, (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      // Solo avanzar la cuenta si el visto bueno verde está activo
      if (!_angleState.isVerticalAligned) {
        return;
      }

      elapsedMs += tickDuration.inMilliseconds;

      final progress = (elapsedMs / totalDurationMs).clamp(0.0, 1.0);
      final remaining = ((totalDurationMs - elapsedMs) / 1000).ceil();

      if (remaining != _scanSecondsRemaining && remaining > 0) {
        HapticFeedback.selectionClick();
      }

      setState(() {
        _scanProgress = progress;
        _scanSecondsRemaining = remaining;
      });

      if (elapsedMs >= totalDurationMs) {
        timer.cancel();
        _analyzeRealPoseFromCamera();
      }
    });
  }

  Future<void> _analyzeRealPoseFromCamera() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }
    if (_isAnalyzingPose) return;

    setState(() {
      _isAnalyzingPose = true;
      _poseDetectionError = null;
    });

    try {
      // 1. Capturar un cuadro de alta fidelidad con la cámara del iPhone
      final xfile = await _cameraController!.takePicture();

      // 2. Ejecutar Apple Vision Framework nativo en el A17 Pro con calibración de género
      final dynamic rawResult = await _poseChannel.invokeMethod('detectPose', {
        'imagePath': xfile.path,
        'gender': _selectedGender,
      });

      if (!mounted) return;

      if (rawResult is Map) {
        final detected = rawResult['detected'] as bool? ?? false;
        if (detected) {
          final estimatedCm = (rawResult['estimatedShouldersCm'] as num?)?.toDouble() ?? 44.0;
          final ratio = (rawResult['shoulderRatio'] as num?)?.toDouble() ?? 0.45;
          final angle = (rawResult['shoulderAngle'] as num?)?.toDouble() ?? 0.0;
          final distMeters = (rawResult['estimatedDistanceMeters'] as num?)?.toDouble();

          Offset neck = const Offset(0.50, 0.34);
          if (rawResult['neck'] is Map) {
            final nMap = rawResult['neck'] as Map;
            neck = Offset(
              (nMap['x'] as num?)?.toDouble() ?? 0.50,
              (nMap['y'] as num?)?.toDouble() ?? 0.34,
            );
          }

          HapticFeedback.heavyImpact(); // Taptic Engine Success
          _scanAnimationController.stop();
          setState(() {
            _userShouldersCm = estimatedCm;
            if (distMeters != null && distMeters > 0) {
              _distanceState = UserDistanceState(
                estimatedDistanceMeters: distMeters,
                isDistanceOptimal: distMeters >= 1.4 && distMeters <= 2.2,
              );
            } else {
              _distanceState = UserDistanceState.fromShoulderRatio(ratio);
            }
            _detectedNeck = neck;
            _detectedShoulderAngle = angle;
            _detectedShoulderRatio = ratio;
            _poseSmoother.reset();
            _poseSmoother.update(
              neck: neck,
              shoulderAngle: angle,
              shoulderRatio: ratio,
              scaleMultiplier: _currentScaleMultiplier,
            );
            _currentStep = FittingStep.diagnosis;
            _recalculateFit();
            _isAnalyzingPose = false;
            _poseDetectionError = null;
          });
          return;
        } else {
          // No se detectó persona (ej. piso, zapatos, pared vacía o persona sentada de lado)
          final message = rawResult['message'] as String? ??
              'No se detectó una persona de frente. Asegúrate de mostrar rostro y torso erguido a ~1.7 metros.';
          HapticFeedback.mediumImpact();

          setState(() {
            _isAnalyzingPose = false;
            _poseDetectionError = message;
            _scanProgress = 0.0;
            _scanSecondsRemaining = 3;
          });

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.amberAccent, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      message,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFF0F172A),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 5),
            ),
          );
          return;
        }
      }
    } catch (e) {
      debugPrint('Error analizando silueta con Apple Vision: $e');
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() {
        _isAnalyzingPose = false;
        _poseDetectionError =
            'No se pudo completar el análisis de silueta ($e). Asegúrate de encuadrar de pie a ~1.7m.';
      });
    }
  }

  void _skipScanManual() {
    _scanTimer?.cancel();
    HapticFeedback.selectionClick();
    setState(() {
      _currentStep = FittingStep.diagnosis;
      _recalculateFit();
    });
  }

  void _initPrendaState() {
    _recalculateFit();
    _activeSize = widget.initialVariant?.size ?? _recommendation.recommendedSize;
    _activeColor = widget.initialVariant?.color ??
        (widget.product.colors.isNotEmpty ? widget.product.colors.first : 'Negro');
    _findActiveVariant();
  }

  void _recalculateFit() {
    final sizes = widget.product.sizes.isNotEmpty
        ? widget.product.sizes
        : ['S', 'M', 'L', 'XL'];

    _recommendation = FittingEngine.evaluate(
      measurements: widget.measurements,
      availableSizes: sizes,
      userShouldersCm: _userShouldersCm,
      gender: _selectedGender,
      bodyBuild: _selectedBodyBuild,
    );

    _activeSize = _recommendation.recommendedSize;
    _findActiveVariant();
  }

  void _findActiveVariant() {
    try {
      _activeVariant = widget.product.variants.firstWhere(
        (v) => v.size == _activeSize && v.color == _activeColor,
        orElse: () => widget.product.variants.firstWhere(
          (v) => v.color == _activeColor,
          orElse: () => widget.product.variants.first,
        ),
      );
    } catch (_) {
      _activeVariant = widget.initialVariant;
    }
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) return;

      int targetIndex = _cameras.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
      );
      if (targetIndex == -1) targetIndex = 0;

      await _setupCameraController(_cameras[targetIndex]);
      setState(() {
        _currentCameraIndex = targetIndex;
      });
    } catch (e) {
      debugPrint('Error inicializando cámara: $e');
    }
  }

  Future<void> _setupCameraController(CameraDescription description) async {
    final prev = _cameraController;
    final controller = CameraController(
      description,
      ResolutionPreset.high,
      enableAudio: false,
    );

    try {
      await controller.initialize();
      await prev?.dispose();

      if (!mounted) {
        await controller.dispose();
        return;
      }

      setState(() {
        _cameraController = controller;
        _isCameraInitialized = true;
      });
    } catch (e) {
      debugPrint('Error configurando controlador: $e');
    }
  }

  Future<void> _toggleCamera() async {
    if (_cameras.length < 2) return;
    HapticFeedback.selectionClick();

    final nextIndex = (_currentCameraIndex + 1) % _cameras.length;
    await _setupCameraController(_cameras[nextIndex]);
    setState(() {
      _currentCameraIndex = nextIndex;
    });
  }

  Future<void> _toggleFlash() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }
    HapticFeedback.selectionClick();
    try {
      final newFlash = !_isFlashOn;
      await _cameraController!.setFlashMode(
        newFlash ? FlashMode.torch : FlashMode.off,
      );
      setState(() => _isFlashOn = newFlash);
    } catch (_) {}
  }

  @override
  void dispose() {
    _scanTimer?.cancel();
    _scanAnimationController.dispose();
    _cameraController?.dispose();
    _accelerometerSub?.cancel();
    super.dispose();
  }

  double get _currentScaleMultiplier {
    return _recommendation.sizeScales[_activeSize] ?? 1.0;
  }

  String? get _activeImageUrl {
    if (_activeVariant != null && widget.images.isNotEmpty) {
      final match = widget.images.firstWhere(
        (img) => img.colorId == _activeVariant!.colorId,
        orElse: () => widget.images.first,
      );
      if (match.url.isNotEmpty) return match.url;
    }
    if (widget.images.isNotEmpty) {
      return widget.images.first.url;
    }
    return widget.product.image?.url;
  }

  Future<void> _addToCart() async {
    if (_activeVariant == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Esta combinación no tiene inventario disponible.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    HapticFeedback.heavyImpact();
    await ref.read(cartProvider.notifier).addItem(
          variantId: _activeVariant!.id,
          quantity: 1,
        );

    if (!mounted) return;

    final cartState = ref.read(cartProvider);
    if (!cartState.hasError) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${widget.product.name} (Talla $_activeSize) añadida al carrito.',
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'Ver Carrito',
            textColor: Colors.white,
            onPressed: () {
              context.pop();
              context.go('/carrito');
            },
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            cartState.error.toString().replaceAll('ApiException: ', ''),
          ),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  void _capturePhoto() {
    HapticFeedback.mediumImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            Icon(Icons.camera_alt_rounded, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Text('¡Look capturado! Guardado en la sesión.'),
          ],
        ),
        backgroundColor: AppColors.cobalt,
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  Widget _buildBodyBuildSelector({bool compact = false, StateSetter? setModalState}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildBuildChip(BodyBuild.slim, 'Delgada', compact, setModalState),
        const SizedBox(width: 6),
        _buildBuildChip(BodyBuild.regular, 'Regular', compact, setModalState),
        const SizedBox(width: 6),
        _buildBuildChip(BodyBuild.full, 'Robusta (+Peso)', compact, setModalState),
      ],
    );
  }

  Widget _buildBuildChip(
    BodyBuild build,
    String label,
    bool compact,
    StateSetter? setModalState,
  ) {
    final isSelected = _selectedBodyBuild == build;
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        if (setModalState != null) {
          setModalState(() {
            _selectedBodyBuild = build;
          });
        }
        setState(() {
          _selectedBodyBuild = build;
          _recalculateFit();
        });
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 10 : 12,
          vertical: compact ? 5 : 7,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF10B981)
              : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF34D399)
                : Colors.white.withValues(alpha: 0.18),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white70,
            fontSize: compact ? 11 : 12.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ),
    );
  }

  void _showCalibrationSheet() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Row(
                      children: [
                        Icon(Icons.tune_rounded, color: Color(0xFF38BDF8), size: 22),
                        SizedBox(width: 10),
                        Text(
                          'Calibración Fina de Medidas',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Ajusta tu contextura para refinar el cálculo inteligente de talla.',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Contextura corporal
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Contextura / Complexión:',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        if (_selectedBodyBuild == BodyBuild.full)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              '+1 Talla confort',
                              style: TextStyle(
                                color: Color(0xFFFBBF24),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _buildBodyBuildSelector(compact: false, setModalState: setModalState),
                    const SizedBox(height: 20),

                    // Slider de hombros
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Ancho de Hombros:',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.cobalt.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.cobalt),
                          ),
                          child: Text(
                            '${_userShouldersCm.toStringAsFixed(1)} cm',
                            style: const TextStyle(
                              color: Color(0xFF38BDF8),
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Slider(
                      value: _userShouldersCm.clamp(36.0, 56.0),
                      min: 36.0,
                      max: 56.0,
                      divisions: 40,
                      activeColor: AppColors.cobalt,
                      inactiveColor: Colors.white.withValues(alpha: 0.15),
                      onChanged: (val) {
                        setModalState(() => _userShouldersCm = val);
                        setState(() {
                          _userShouldersCm = val;
                          _recalculateFit();
                        });
                      },
                    ),

                    const SizedBox(height: 24),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                      label: const Text(
                        'Aplicar Medidas',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isFrontCamera = _cameras.isNotEmpty &&
        _cameras[_currentCameraIndex].lensDirection == CameraLensDirection.front;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Visor de Cámara en Vivo (con modo espejo en frontal)
          if (_isCameraInitialized && _cameraController != null)
            Transform(
              alignment: Alignment.center,
              transform: Matrix4.identity()
                ..scale(isFrontCamera ? -1.0 : 1.0, 1.0),
              child: CameraPreview(_cameraController!),
            )
          else
            Container(
              color: const Color(0xFF0F172A),
              child: const Center(
                child: CircularProgressIndicator(color: AppColors.cobalt),
              ),
            ),

          // 2. Capa AR de Guías Anatómicas y Rayo Láser Escáner
          AnimatedBuilder(
            animation: _scanAnimation,
            builder: (context, _) {
              final isCalibrated =
                  _angleState.isVerticalAligned && _distanceState.isDistanceOptimal;
              final headline = FittingTelemetry.evaluate(
                angle: _angleState,
                distance: _distanceState,
              ).guidanceHeadline;

              return CustomPaint(
                painter: FittingOverlayPainter(
                  scaleMultiplier: _currentScaleMultiplier,
                  showGuides: _showGuides,
                  isScanning: _currentStep == FittingStep.scanning,
                  scanLinePosition: _scanAnimation.value,
                  isLocked: _currentStep != FittingStep.scanning,
                  pitchDegrees: _angleState.pitchDegrees,
                  rollDegrees: _angleState.rollDegrees,
                  isAngleOk: _angleState.isVerticalAligned,
                  estimatedDistanceMeters: _distanceState.estimatedDistanceMeters,
                  isDistanceOk: _distanceState.isDistanceOptimal,
                  isCalibrated: isCalibrated,
                  guidanceHeadline: headline,
                ),
              );
            },
          ),

          // 3. Prenda proyectada reactiva anclada a cuello y hombros (Hito 5.2)
          if (_currentStep == FittingStep.activeFitting)
            GarmentArOverlay(
              imageUrl: _activeImageUrl,
              pose: _poseSmoother.update(
                neck: _detectedNeck,
                shoulderAngle: _detectedShoulderAngle,
                shoulderRatio: _detectedShoulderRatio,
                scaleMultiplier: _currentScaleMultiplier,
              ),
            ),

          // 4. Barra Superior Flotante
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _glassButton(
                      icon: Icons.arrow_back_ios_new_rounded,
                      onTap: () => context.pop(),
                    ),
                    if (_currentStep == FittingStep.scanning)
                      _buildGenderSelector(),
                    Row(
                      children: [
                        // Botón de Re-escanear (visible cuando no está escaneando)
                        if (_currentStep != FittingStep.scanning) ...[
                          _glassButton(
                            icon: Icons.radar_rounded,
                            onTap: _startScanSequence,
                          ),
                          const SizedBox(width: 8),
                          _glassButton(
                            icon: Icons.tune_rounded,
                            onTap: _showCalibrationSheet,
                          ),
                          const SizedBox(width: 8),
                        ],
                        _glassButton(
                          icon: _showGuides
                              ? Icons.grid_on_rounded
                              : Icons.grid_off_rounded,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() => _showGuides = !_showGuides);
                          },
                        ),
                        const SizedBox(width: 8),
                        if (!isFrontCamera) ...[
                          _glassButton(
                            icon: _isFlashOn
                                ? Icons.flash_on_rounded
                                : Icons.flash_off_rounded,
                            onTap: _toggleFlash,
                          ),
                          const SizedBox(width: 8),
                        ],
                        _glassButton(
                          icon: Icons.flip_camera_ios_rounded,
                          onTap: _toggleCamera,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 4.5. HUD de Telemetría iPhone 15 Pro Max (Ángulo 90° + Distancia)
          if (_showGuides && _currentStep == FittingStep.scanning)
            _buildTelemetryHUD(),

          // 5. Contenido dinámico según el paso:
          // A) MODO ESCANEO (Scanning Step)
          if (_currentStep == FittingStep.scanning)
            _buildScanningOverlay(context),

          // B) TARJETA DE DIAGNÓSTICO (Diagnosis Step)
          if (_currentStep == FittingStep.diagnosis)
            _buildDiagnosisSheet(context),

          // C) MODO VESTIDOR EN VIVO (Active Fitting Step)
          if (_currentStep == FittingStep.activeFitting) ...[
            _buildFittingHeaderBadge(),
            _buildActiveFittingControls(context),
          ],
        ],
      ),
    );
  }

  // --- SUB-WIDGETS PARA CADA PASO ---

  /// HUD de Telemetría Pro para iPhone 15 Pro Max (Ángulo 90° CoreMotion + Distancia)
  Widget _buildTelemetryHUD() {
    final telemetry = FittingTelemetry.evaluate(
      angle: _angleState,
      distance: _distanceState,
    );

    final isCalibrated = telemetry.isCalibrated;
    final angleOk = _angleState.isVerticalAligned;
    final distOk = _distanceState.isDistanceOptimal;

    return Positioned(
      top: MediaQuery.of(context).padding.top + 52,
      left: 16,
      right: 16,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A).withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isCalibrated
                ? const Color(0xFF10B981).withValues(alpha: 0.8)
                : (!angleOk
                    ? const Color(0xFFF59E0B).withValues(alpha: 0.7)
                    : Colors.white.withValues(alpha: 0.2)),
            width: 1.4,
          ),
          boxShadow: [
            BoxShadow(
              color: isCalibrated
                  ? const Color(0xFF10B981).withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.4),
              blurRadius: 16,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                // Inclinación vertical (Pitch a 90°)
                _telemetryChip(
                  icon: Icons.screen_rotation_rounded,
                  label: 'Ángulo',
                  value: '${_angleState.pitchDegrees.toStringAsFixed(1)}°',
                  status: angleOk
                      ? '90° [OK]'
                      : (_angleState.pitchDegrees < 87.0
                          ? '▲ INCLINAR'
                          : '▼ INCLINAR'),
                  isOk: angleOk,
                ),
                Container(
                  width: 1,
                  height: 26,
                  color: Colors.white.withValues(alpha: 0.15),
                ),
                // Distancia (~1.7m)
                _telemetryChip(
                  icon: Icons.straighten_rounded,
                  label: 'Distancia',
                  value: _distanceState.estimatedDistanceMeters > 0
                      ? '~${_distanceState.estimatedDistanceMeters.toStringAsFixed(1)}m'
                      : '--',
                  status: distOk
                      ? 'ÓPTIMA'
                      : (_distanceState.estimatedDistanceMeters < 1.50
                          ? 'ALÉJATE'
                          : 'ACÉRCATE'),
                  isOk: distOk,
                ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              isCalibrated
                  ? '✓ Nivelado a 90° y distancia lista: Presiona "Escanear Silueta Ahora"'
                  : (!angleOk ? 'Inclina el teléfono vertical a 90°' : 'Ajusta tu distancia a ~1.7 metros'),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: isCalibrated ? const Color(0xFF34D399) : Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _telemetryChip({
    required IconData icon,
    required String label,
    required String value,
    required String status,
    required bool isOk,
  }) {
    final color = isOk ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label.toUpperCase(),
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                color: Colors.white.withValues(alpha: 0.5),
                letterSpacing: 0.8,
              ),
            ),
            Row(
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  /// Overlay de Escaneo (Paso 1)
  Widget _buildScanningOverlay(BuildContext context) {
    final isGreen = _angleState.isVerticalAligned;

    return Positioned.fill(
      child: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 70),

            // Badge Superior de Estado Dinámico (Verde cuando está listo a 90°)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isGreen
                    ? const Color(0xFF0F172A).withValues(alpha: 0.9)
                    : Colors.black.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isGreen
                      ? const Color(0xFF10B981)
                      : const Color(0xFFF59E0B),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: isGreen
                        ? const Color(0xFF10B981).withValues(alpha: 0.35)
                        : const Color(0xFFF59E0B).withValues(alpha: 0.2),
                    blurRadius: 14,
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isGreen
                        ? Icons.check_circle_rounded
                        : Icons.screen_rotation_rounded,
                    color: isGreen
                        ? const Color(0xFF10B981)
                        : const Color(0xFFF59E0B),
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isGreen
                        ? 'TELÉFONO A 90° LISTO - PRESIONA ESCANEAR'
                        : '1. COLOCA EL TELÉFONO VERTICAL A 90°',
                    style: TextStyle(
                      color: isGreen
                          ? const Color(0xFF34D399)
                          : Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.9,
                    ),
                  ),
                ],
              ),
            ),

            const Spacer(),

            // Tarjeta inferior de estado y control de escaneo
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.94),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                    color: isGreen
                        ? const Color(0xFF10B981).withValues(alpha: 0.5)
                        : Colors.white.withValues(alpha: 0.15),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: isGreen
                          ? const Color(0xFF10B981).withValues(alpha: 0.2)
                          : Colors.black.withValues(alpha: 0.6),
                      blurRadius: 20,
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Texto guía principal
                    Text(
                      isGreen
                          ? '¡Posición a 90° lista! Presiona para escanear'
                          : 'Alinea el teléfono a 90° para habilitar el escaneo',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Selector de contextura previa al escaneo
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Contextura:',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.75),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _buildBodyBuildSelector(compact: true),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Estado de análisis con Apple Vision / ML Kit
                    if (_isAnalyzingPose) ...[
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                color: Color(0xFF38BDF8),
                              ),
                            ),
                            SizedBox(width: 12),
                            Text(
                              'Analizando silueta humana en tiempo real...',
                              style: TextStyle(
                                color: Color(0xFF38BDF8),
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Alerta si falló la detección (ej. piso, frazada, sin persona)
                    if (_poseDetectionError != null) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFFEF4444).withValues(alpha: 0.6),
                            width: 1.2,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.warning_amber_rounded,
                              color: Color(0xFFF87171),
                              size: 22,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _poseDetectionError!,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  height: 1.3,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Si el temporizador manual de 3s está corriendo
                    if (_scanProgress > 0) ...[
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: _scanProgress,
                          minHeight: 8,
                          backgroundColor: Colors.white.withValues(alpha: 0.1),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            Color(0xFF38BDF8),
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Escaneando en ${_scanSecondsRemaining}s...',
                        style: const TextStyle(
                          color: Color(0xFF38BDF8),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Botón Principal de Escaneo Manual (Solución al disparo involuntario)
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _isAnalyzingPose
                            ? null
                            : () {
                                if (!isGreen) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Coloca el teléfono vertical a 90° para habilitar el escaneo.'),
                                      backgroundColor: Color(0xFF0F172A),
                                      duration: Duration(seconds: 2),
                                    ),
                                  );
                                  return;
                                }
                                _analyzeRealPoseFromCamera();
                              },
                        icon: _isAnalyzingPose
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Icon(
                                isGreen
                                    ? Icons.camera_rounded
                                    : Icons.screen_rotation_rounded,
                                size: 20,
                              ),
                        label: Text(
                          _isAnalyzingPose
                              ? 'Procesando silueta...'
                              : (isGreen
                                  ? 'Escanear Silueta Ahora'
                                  : 'Esperando Posición a 90°...'),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14.5,
                            letterSpacing: 0.5,
                          ),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: isGreen
                              ? const Color(0xFF10B981)
                              : const Color(0xFF334155),
                          disabledBackgroundColor: const Color(0xFF334155),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 6),

                    // Opciones secundarias (Temporizador manual 3s y calibrar manual)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton.icon(
                          onPressed: _isAnalyzingPose
                              ? null
                              : () {
                                  if (!isGreen) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Coloca el teléfono a 90° para iniciar el temporizador.'),
                                        backgroundColor: Color(0xFF0F172A),
                                        duration: Duration(seconds: 2),
                                      ),
                                    );
                                    return;
                                  }
                                  _startScanSequence();
                                },
                          icon: const Icon(Icons.timer_outlined, size: 16, color: Colors.white70),
                          label: const Text(
                            'Temporizador (3s)',
                            style: TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                          style: TextButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                        TextButton(
                          onPressed: _skipScanManual,
                          style: TextButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                            foregroundColor: Colors.white60,
                          ),
                          child: const Text(
                            'Calibrar manual',
                            style: TextStyle(fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Tarjeta de Diagnóstico Inteligente (Paso 2)
  Widget _buildDiagnosisSheet(BuildContext context) {
    return Positioned(
      left: 20,
      right: 20,
      bottom: 30,
      child: SafeArea(
        child: Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: const Color(0xFF0B132B).withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: const Color(0xFF10B981).withValues(alpha: 0.6),
              width: 1.8,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF10B981).withValues(alpha: 0.25),
                blurRadius: 25,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Encabezado con badge
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.verified_rounded,
                      color: Color(0xFF10B981),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '¡Talla Confirmada!',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Medida exacta para esta polera',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.65),
                            fontSize: 11.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 18),

              // Recuadro de Talla Recomendada
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF10B981).withValues(alpha: 0.15),
                      AppColors.cobalt.withValues(alpha: 0.15),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFF10B981).withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TALLA CONFIRMADA',
                          style: TextStyle(
                            color: Color(0xFF34D399),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Talla ${_recommendation.recommendedSize}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${_recommendation.confidence}% Calce',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // Selector interactivo de contextura para ajuste instantáneo
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Contextura corporal:',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (_selectedBodyBuild == BodyBuild.full)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              '+1 Talla confort',
                              style: TextStyle(
                                color: Color(0xFFFBBF24),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _buildBodyBuildSelector(compact: true),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // Justificación anatómica
              Text(
                '• ${_recommendation.verdict}',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 12.5,
                  height: 1.3,
                ),
              ),

              if (_recommendation.isBorderline &&
                  _recommendation.alternativeSize != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.35)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.compare_arrows_rounded,
                          color: Colors.amberAccent, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Tus hombros están en la frontera entre ${_recommendation.recommendedSize} y ${_recommendation.alternativeSize}. En el espejo interactivo podrás probar ambas y comparar su caída.',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // Botón Principal para entrar al vestidor
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.cobalt,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  setState(() {
                    _currentStep = FittingStep.activeFitting;
                  });
                },
                icon: const Icon(Icons.checkroom_rounded, size: 20),
                label: const Text(
                  'Probar Prenda en el Espejo',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),

              const SizedBox(height: 8),

              // Fila secundaria de calibración o re-escaneo
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton.icon(
                    onPressed: _startScanSequence,
                    icon: const Icon(Icons.radar_rounded, size: 16),
                    label: const Text('Re-escanear'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white70,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _showCalibrationSheet,
                    icon: const Icon(Icons.tune_rounded, size: 16),
                    label: const Text('Ajustar medidas'),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF38BDF8),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Píldora de estado en modo vestidor libre
  Widget _buildFittingHeaderBadge() {
    return Positioned(
      top: 110,
      left: 20,
      right: 20,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.65),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: _activeSize == _recommendation.recommendedSize
                  ? const Color(0xFF10B981)
                  : AppColors.cobalt,
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 10,
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _activeSize == _recommendation.recommendedSize
                    ? Icons.stars_rounded
                    : Icons.tune_rounded,
                size: 16,
                color: _activeSize == _recommendation.recommendedSize
                    ? const Color(0xFF10B981)
                    : const Color(0xFF60A5FA),
              ),
              const SizedBox(width: 8),
              Text(
                _activeSize == _recommendation.recommendedSize
                    ? 'Talla $_activeSize · Recomendada por calce (${_recommendation.confidence}%)'
                    : 'Talla $_activeSize · Modo ${(_currentScaleMultiplier > 1.0) ? "Oversize / Holgado" : "Slim / Ceñido"}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Controles inferiores en modo vestidor libre (Paso 3)
  Widget _buildActiveFittingControls(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        decoration: BoxDecoration(
          color: const Color(0xFF0B1120).withValues(alpha: 0.92),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.6),
              blurRadius: 24,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      widget.product.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    'Bs. ${(widget.product.price ?? 0).toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Color(0xFF38BDF8),
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              if (_recommendation.isBorderline &&
                  _recommendation.alternativeSize != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.compare_arrows_rounded,
                            color: Colors.amberAccent, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Talla frontera: Compara $_activeSize con ${_recommendation.alternativeSize} en el espejo',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 8),

              // Selector de Tallas (con estrella en la recomendada)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: (widget.product.sizes.isNotEmpty
                          ? widget.product.sizes
                          : ['S', 'M', 'L', 'XL'])
                      .map((size) {
                    final isSelected = _activeSize == size;
                    final isRecommended =
                        size == _recommendation.recommendedSize;

                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _activeSize = size;
                            _findActiveVariant();
                            _poseSmoother.update(
                              neck: _detectedNeck,
                              shoulderAngle: _detectedShoulderAngle,
                              shoulderRatio: _detectedShoulderRatio,
                              scaleMultiplier: _currentScaleMultiplier,
                            );
                          });
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.cobalt
                                : Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected
                                  ? Colors.white
                                  : (isRecommended
                                      ? const Color(0xFF10B981)
                                      : Colors.transparent),
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                size,
                                style: TextStyle(
                                  color: isSelected
                                      ? Colors.white
                                      : Colors.white70,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                ),
                              ),
                              if (isRecommended) ...[
                                const SizedBox(width: 4),
                                const Icon(
                                  Icons.star_rounded,
                                  size: 13,
                                  color: Color(0xFF10B981),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),

              // Selector de Colores
              if (widget.product.colors.length > 1) ...[
                Row(
                  children: widget.product.colors.map((cName) {
                    final isSelected = _activeColor == cName;
                    return Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _activeColor = cName;
                            _findActiveVariant();
                          });
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSelected
                                  ? Colors.white
                                  : Colors.transparent,
                              width: 2,
                            ),
                          ),
                          child: Center(
                            child: Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _parseColor(cName),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.3),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),
              ],

              // Fila de Acción (Captura y Carrito)
              Row(
                children: [
                  IconButton.filledTonal(
                    onPressed: _capturePhoto,
                    icon: const Icon(Icons.camera_alt_outlined),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.all(12),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.cobalt,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: _addToCart,
                      icon: const Icon(Icons.shopping_bag_outlined, size: 18),
                      label: Text(
                        'Agregar Talla $_activeSize al Carrito',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _glassButton({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }

  Color _parseColor(String colorName) {
    final lower = colorName.toLowerCase();
    if (lower.contains('negro') || lower.contains('black')) return Colors.black;
    if (lower.contains('blanco') || lower.contains('white')) return Colors.white;
    if (lower.contains('azul') || lower.contains('blue')) return const Color(0xFF1E3A8A);
    if (lower.contains('rojo') || lower.contains('red')) return const Color(0xFFDC2626);
    if (lower.contains('verde') || lower.contains('green')) return const Color(0xFF16A34A);
    if (lower.contains('beige') || lower.contains('crema')) return const Color(0xFFF5F5DC);
    if (lower.contains('gris') || lower.contains('gray')) return Colors.grey;
    return AppColors.cobalt;
  }

  Widget _buildGenderSelector() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _genderButton('HOMBRE', '👨 Hombre'),
          _genderButton('MUJER', '👩 Mujer'),
        ],
      ),
    );
  }

  Widget _genderButton(String genderKey, String label) {
    final isSelected = _selectedGender == genderKey;
    return GestureDetector(
      onTap: () {
        if (_selectedGender == genderKey) return;
        HapticFeedback.selectionClick();
        setState(() {
          _selectedGender = genderKey;
          _userShouldersCm = genderKey == 'MUJER' ? 38.0 : 44.0;
          _recalculateFit();
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.cobalt : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white70,
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

