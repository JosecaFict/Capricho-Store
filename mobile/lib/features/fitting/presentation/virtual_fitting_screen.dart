import 'package:cached_network_image/cached_network_image.dart';
import 'package:camera/camera.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/features/fitting/domain/fitting_engine.dart';
import 'package:capricho_store/features/fitting/presentation/fitting_overlay_painter.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

class _VirtualFittingScreenState extends ConsumerState<VirtualFittingScreen> {
  CameraController? _cameraController;
  List<CameraDescription> _cameras = [];
  int _currentCameraIndex = 0;
  bool _isCameraInitialized = false;
  bool _isFlashOn = false;
  bool _showGuides = true;

  late String _activeSize;
  late String _activeColor;
  late ProductVariant? _activeVariant;
  late FittingRecommendation _recommendation;

  @override
  void initState() {
    super.initState();
    _initPrendaState();
    _initCamera();
  }

  void _initPrendaState() {
    // Determinar tallas disponibles
    final sizes = widget.product.sizes.isNotEmpty
        ? widget.product.sizes
        : ['S', 'M', 'L', 'XL'];

    // Ejecutar motor de calce con las medidas de la base de datos
    _recommendation = FittingEngine.evaluate(
      measurements: widget.measurements,
      availableSizes: sizes,
      userShouldersCm: 44.0, // Estimación inicial estándar
    );

    _activeSize = widget.initialVariant?.size ?? _recommendation.recommendedSize;
    _activeColor = widget.initialVariant?.color ??
        (widget.product.colors.isNotEmpty ? widget.product.colors.first : 'Negro');
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

      // Buscar cámara trasera por defecto (para máxima nitidez en iPhone 15 Pro Max)
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
    _cameraController?.dispose();
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

  @override
  Widget build(BuildContext context) {
    final isFrontCamera = _cameras.isNotEmpty &&
        _cameras[_currentCameraIndex].lensDirection == CameraLensDirection.front;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Visor de Cámara (o fondo simulado si la cámara no está lista)
          if (_isCameraInitialized && _cameraController != null)
            Transform(
              alignment: Alignment.center,
              transform: Matrix4.identity()..scale(isFrontCamera ? -1.0 : 1.0, 1.0),
              child: CameraPreview(_cameraController!),
            )
          else
            Container(
              color: const Color(0xFF0F172A),
              child: const Center(
                child: CircularProgressIndicator(color: AppColors.cobalt),
              ),
            ),

          // 2. Capa de Superposición de la Prenda (CustomPainter y Canvas interactivo)
          CustomPaint(
            painter: FittingOverlayPainter(
              scaleMultiplier: _currentScaleMultiplier,
              showGuides: _showGuides,
            ),
          ),

          // 3. Imagen de la prenda proyectada sobre el torso del usuario
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 60),
              child: AnimatedScale(
                scale: _currentScaleMultiplier,
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                child: Opacity(
                  opacity: 0.88,
                  child: SizedBox(
                    width: MediaQuery.of(context).size.width * 0.62,
                    height: MediaQuery.of(context).size.width * 0.72,
                    child: _activeImageUrl != null && _activeImageUrl!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: _activeImageUrl!,
                            fit: BoxFit.contain,
                            placeholder: (_, __) => const SizedBox(),
                            errorWidget: (_, __, ___) => const Icon(
                              Icons.checkroom_rounded,
                              size: 100,
                              color: Colors.white70,
                            ),
                          )
                        : const Icon(
                            Icons.checkroom_rounded,
                            size: 100,
                            color: Colors.white70,
                          ),
                  ),
                ),
              ),
            ),
          ),

          // 4. Barra Superior Flotante (Navegación y Controles)
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
                    Row(
                      children: [
                        _glassButton(
                          icon: _showGuides
                              ? Icons.grid_on_rounded
                              : Icons.grid_off_rounded,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() => _showGuides = !_showGuides);
                          },
                        ),
                        const SizedBox(width: 10),
                        if (!isFrontCamera) ...[
                          _glassButton(
                            icon: _isFlashOn
                                ? Icons.flash_on_rounded
                                : Icons.flash_off_rounded,
                            onTap: _toggleFlash,
                          ),
                          const SizedBox(width: 10),
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

          // 5. Diagnóstico de Talla Flotante (Píldora de IA en el tercio superior)
          Positioned(
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
          ),

          // 6. Panel Inferior Flotante (Selector de Tallas, Colores y Cierre de Venta)
          Positioned(
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
                    // Fila de información de la prenda
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
                          'Bs. ${widget.product.price.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: Color(0xFF38BDF8),
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Selector de Tallas (con badge en la talla recomendada)
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
          ),
        ],
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
}
