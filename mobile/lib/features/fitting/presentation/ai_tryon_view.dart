import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:camera/camera.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/features/fitting/domain/tryon_models.dart';
import 'package:capricho_store/features/fitting/presentation/tryon_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

/// Vista principal del Probador Virtual con IA Fotorealista (Replicate IDM-VTON).
/// Implementa los pasos 3, 4 y 5 del flujo aprobado:
/// - Paso 3: Selección de imagen (Cámara en vivo, Galería o Sesión actual)
/// - Paso 4: Selección de color, verificación de cuota y generación con IA
/// - Paso 5: Vista de resultados (Antes/Después), Guardar foto y Añadir al Carrito con cross-selling
class AiTryOnView extends ConsumerStatefulWidget {
  const AiTryOnView({
    super.key,
    required this.product,
    required this.recommendedSize,
    required this.selectedColor,
    required this.onColorChanged,
    required this.onAddToCart,
    required this.onBackToDiagnosis,
    this.cameraController,
  });

  final Product product;
  final String recommendedSize;
  final String selectedColor;
  final ValueChanged<String> onColorChanged;
  final Future<void> Function() onAddToCart;
  final VoidCallback onBackToDiagnosis;
  final CameraController? cameraController;

  @override
  ConsumerState<AiTryOnView> createState() => _AiTryOnViewState();
}

class _AiTryOnViewState extends ConsumerState<AiTryOnView> {
  final ImagePicker _picker = ImagePicker();
  bool _isTakingLivePhoto = false;
  bool _isAddingToCart = false;

  @override
  void initState() {
    super.initState();
    // Cargar cuota actualizada al entrar
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(tryOnControllerProvider.notifier).fetchQuota();
    });
  }

  // -------------------------------------------------------------
  // PASO 3: MÉTODOS DE CAPTURA / SELECCIÓN DE FOTO
  // -------------------------------------------------------------

  Future<void> _pickImage(ImageSource source) async {
    HapticFeedback.selectionClick();
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 88,
      );
      if (picked != null && mounted) {
        HapticFeedback.mediumImpact();
        ref.read(tryOnControllerProvider.notifier).setSessionPhoto(picked.path);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No se pudo cargar la imagen: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _captureFromActiveCamera() async {
    if (widget.cameraController == null ||
        !widget.cameraController!.value.isInitialized) {
      // Fallback al picker del sistema si el controlador no está listo
      await _pickImage(ImageSource.camera);
      return;
    }

    if (_isTakingLivePhoto) return;
    setState(() => _isTakingLivePhoto = true);
    HapticFeedback.selectionClick();

    try {
      final xfile = await widget.cameraController!.takePicture();
      if (mounted) {
        HapticFeedback.heavyImpact();
        ref.read(tryOnControllerProvider.notifier).setSessionPhoto(xfile.path);
      }
    } catch (e) {
      if (mounted) {
        // Fallback a image_picker en caso de error
        await _pickImage(ImageSource.camera);
      }
    } finally {
      if (mounted) {
        setState(() => _isTakingLivePhoto = false);
      }
    }
  }

  // -------------------------------------------------------------
  // PASO 4: GENERACIÓN CON IA (REPLICATE IDM-VTON)
  // -------------------------------------------------------------

  Future<void> _generateLook() async {
    final state = ref.read(tryOnControllerProvider);
    final photoPath = state.sessionPhotoPath;

    if (photoPath == null || photoPath.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor toma o selecciona una foto primero.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    // Verificar si quedan pruebas disponibles
    if (state.quota != null && state.quota!.remainingToday <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Has alcanzado el límite diario de 5 pruebas. Vuelve mañana para más pruebas.',
          ),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    HapticFeedback.heavyImpact();

    // Obtener ID del color si existe
    int? colorId;
    try {
      final variant = widget.product.variants.firstWhere(
        (v) => v.color.toLowerCase() == widget.selectedColor.toLowerCase(),
      );
      colorId = variant.colorId;
    } catch (_) {}

    await ref.read(tryOnControllerProvider.notifier).startTryOn(
          productId: widget.product.id,
          imagePath: photoPath,
          colorId: colorId,
          colorName: widget.selectedColor,
        );
  }

  // -------------------------------------------------------------
  // PASO 5: RESULTADO, GUARDAR Y AÑADIR AL CARRITO
  // -------------------------------------------------------------

  Future<void> _savePhoto(String imageUrl) async {
    HapticFeedback.selectionClick();
    try {
      final uri = Uri.parse(imageUrl);
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.download_done_rounded, color: Colors.white, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Abriendo look en alta resolución para guardar en tu galería.',
                  ),
                ),
              ],
            ),
            backgroundColor: Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No se pudo abrir la foto: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _handleAddToCart() async {
    if (_isAddingToCart) return;
    setState(() => _isAddingToCart = true);

    try {
      await widget.onAddToCart();
      if (mounted) {
        await _showCrossSellingDialog();
      }
    } finally {
      if (mounted) {
        setState(() => _isAddingToCart = false);
      }
    }
  }

  Future<void> _showCrossSellingDialog() async {
    final quota = ref.read(tryOnControllerProvider).quota;
    final remaining = quota?.remainingToday ?? 5;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF10B981),
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                '¡Añadido al carrito!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${widget.product.name} (Talla ${widget.recommendedSize} · Color ${widget.selectedColor}) se añadió a tu bolsa.',
              style: const TextStyle(
                color: Color(0xFFE2E8F0),
                fontSize: 13.5,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.cobalt.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.cobalt.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome, color: Color(0xFF60A5FA), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Te quedan $remaining ${remaining == 1 ? "prueba disponible" : "pruebas disponibles"} hoy. Tu foto se mantendrá lista para probarte otra prenda con 1 solo toque.',
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
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Seguir viendo'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    context.pop(); // Vuelve al catálogo, conservando foto de sesión
                  },
                  icon: const Icon(Icons.checkroom_rounded, size: 16),
                  label: const Text('Probar otra'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.cobalt,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: () {
                Navigator.of(ctx).pop();
                context.pop();
                context.go('/carrito');
              },
              icon: const Icon(Icons.shopping_bag_outlined, size: 18),
              label: const Text('Ir a Pagar al Carrito'),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF60A5FA),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // BUILD PRINCIPAL
  // -------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(tryOnControllerProvider);
    final quota = state.quota;
    final activeTask = state.activeTask;
    final isProcessing = state.isGenerating;
    final hasCompleted = activeTask?.isCompleted == true &&
        activeTask?.resultImageUrl != null;
    final hasPhoto = state.sessionPhotoPath != null;

    return Container(
      color: const Color(0xFF090D16).withValues(alpha: 0.95),
      child: SafeArea(
        child: Column(
          children: [
            // Barra Superior de la Vista IA
            _buildTopBar(quota),

            // Contenido desplazable
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Banner de Talla Recomendada (Resultado de MediaPipe en Paso 2)
                    _buildSizeDiagnosisBanner(),

                    const SizedBox(height: 14),

                    // Área central: Previsualización de Foto o Resultado IA
                    if (isProcessing)
                      _buildProcessingCard(activeTask)
                    else if (hasCompleted)
                      _buildResultCard(state, activeTask!)
                    else if (hasPhoto)
                      _buildSelectedPhotoCard(state.sessionPhotoPath!)
                    else
                      _buildPhotoSourcePicker(),

                    const SizedBox(height: 16),

                    // Selector de Colores Disponibles
                    if (!isProcessing) _buildColorSelector(state),

                    const SizedBox(height: 16),

                    // Mensaje de Error si ocurrió alguno
                    if (state.error != null)
                      _buildErrorBanner(state.error!),

                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),

            // Barra Inferior de Acciones
            _buildBottomActionBar(state, hasPhoto, isProcessing, hasCompleted),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // SUB-WIDGETS
  // -------------------------------------------------------------

  Widget _buildTopBar(TryOnQuota? quota) {
    final remaining = quota?.remainingToday ?? 5;
    final limit = quota?.dailyLimit ?? 5;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: widget.onBackToDiagnosis,
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
            style: IconButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.12),
            ),
          ),
          Column(
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.auto_awesome, color: Color(0xFF60A5FA), size: 16),
                  const SizedBox(width: 6),
                  const Text(
                    'Vestidor IA Fotorealista',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              const Text(
                'Motor Replicate IDM-VTON',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          // Píldora de cuota diaria
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: remaining > 0
                  ? const Color(0xFF10B981).withValues(alpha: 0.18)
                  : Colors.red.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: remaining > 0
                    ? const Color(0xFF10B981).withValues(alpha: 0.4)
                    : Colors.red.withValues(alpha: 0.4),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.bolt_rounded,
                  size: 14,
                  color: remaining > 0 ? const Color(0xFF34D399) : Colors.redAccent,
                ),
                const SizedBox(width: 4),
                Text(
                  '$remaining/$limit hoy',
                  style: TextStyle(
                    color: remaining > 0 ? const Color(0xFF34D399) : Colors.redAccent,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Banner del Paso 2 (Confirmación de talla MediaPipe)
  Widget _buildSizeDiagnosisBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B).withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFF38BDF8).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.straighten_rounded, color: Color(0xFF38BDF8), size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'Talla sugerida por escaneo: ',
                      style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                    ),
                    Text(
                      widget.recommendedSize,
                      style: const TextStyle(
                        color: Color(0xFF38BDF8),
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'El motor de IA adaptará la caída de ${widget.product.name} sobre tu silueta.',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// PASO 3: Selector de Origen de Foto (Cámara en vivo o Galería)
  Widget _buildPhotoSourcePicker() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF131D31),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        children: [
          const Icon(Icons.add_a_photo_outlined, color: Color(0xFF60A5FA), size: 42),
          const SizedBox(height: 12),
          const Text(
            'Elige cómo probarte la prenda',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Párate de frente con buena luz y torso visible para un resultado óptimo.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12.5),
          ),
          const SizedBox(height: 20),

          // Botón 1: Tomar foto con la cámara
          FilledButton.icon(
            onPressed: _captureFromActiveCamera,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.cobalt,
              minimumSize: const Size(double.infinity, 46),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.camera_alt_rounded, size: 18),
            label: const Text(
              'Tomar foto con la cámara',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
            ),
          ),

          const SizedBox(height: 10),

          // Botón 2: Elegir de la galería
          OutlinedButton.icon(
            onPressed: () => _pickImage(ImageSource.gallery),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withValues(alpha: 0.25)),
              minimumSize: const Size(double.infinity, 46),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.photo_library_rounded, size: 18),
            label: const Text(
              'Elegir de mi galería',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  /// Tarjeta de la foto seleccionada lista para procesar
  Widget _buildSelectedPhotoCard(String photoPath) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF131D31),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                child: AspectRatio(
                  aspectRatio: 3 / 4,
                  child: Image.file(
                    File(photoPath),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 14),
                      SizedBox(width: 6),
                      Text(
                        'Tu silueta',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.photo_rounded, color: Color(0xFF60A5FA), size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Foto cargada en sesión',
                      style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                    ),
                  ],
                ),
                TextButton.icon(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    _showChangePhotoModal();
                  },
                  icon: const Icon(Icons.refresh_rounded, size: 15),
                  label: const Text('Cambiar'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF38BDF8),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showChangePhotoModal() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Cambiar foto para la prueba',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt_rounded, color: Color(0xFF60A5FA)),
                title: const Text('Tomar nueva foto', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _captureFromActiveCamera();
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_rounded, color: Color(0xFF34D399)),
                title: const Text('Elegir de la galería', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _pickImage(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Tarjeta de procesamiento en curso (con GPU y Replicate)
  Widget _buildProcessingCard(TryOnTask? activeTask) {
    final progress = activeTask?.progress ?? 20;
    final eta = activeTask?.etaSeconds ?? 15;
    final message = activeTask?.stepMessage ?? 'Iniciando escaneo...';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      decoration: BoxDecoration(
        color: const Color(0xFF131D31),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.cobalt.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: AppColors.cobalt.withValues(alpha: 0.15),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        children: [
          // Indicador circular animado
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 90,
                height: 90,
                child: CircularProgressIndicator(
                  value: progress / 100.0,
                  strokeWidth: 6,
                  backgroundColor: Colors.white.withValues(alpha: 0.1),
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF38BDF8)),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$progress%',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    '~${eta}s',
                    style: const TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Replicate IDM-VTON ajustando pliegues, sombras y ajuste anatómico.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 20),
          TextButton(
            onPressed: () {
              ref.read(tryOnControllerProvider.notifier).cancelGeneration();
            },
            child: const Text(
              'Cancelar',
              style: TextStyle(color: Colors.white60, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  /// PASO 5: Tarjeta de Resultado con Toggle Antes / Después
  Widget _buildResultCard(TryOnState state, TryOnTask activeTask) {
    final showBefore = state.showBefore;
    final originalPhotoPath = state.sessionPhotoPath;
    final resultImageUrl = activeTask.resultImageUrl!;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF131D31),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF10B981).withValues(alpha: 0.15),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Imagen interactiva Antes / Después
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 3 / 4,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: showBefore && originalPhotoPath != null
                      ? Image.file(
                          File(originalPhotoPath),
                          key: const ValueKey('before_photo'),
                          fit: BoxFit.cover,
                          width: double.infinity,
                        )
                      : CachedNetworkImage(
                          key: ValueKey(resultImageUrl),
                          imageUrl: resultImageUrl,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          placeholder: (context, url) => Container(
                            color: Colors.black26,
                            child: const Center(
                              child: CircularProgressIndicator(color: AppColors.cobalt),
                            ),
                          ),
                          errorWidget: (context, url, error) => const Center(
                            child: Icon(Icons.broken_image_rounded, color: Colors.white54, size: 40),
                          ),
                        ),
                ),
              ),

              // Píldora de estado (Look IA vs Original)
              Positioned(
                top: 12,
                left: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: showBefore
                          ? Colors.white30
                          : const Color(0xFF10B981).withValues(alpha: 0.8),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        showBefore ? Icons.person_rounded : Icons.auto_awesome,
                        color: showBefore ? Colors.white70 : const Color(0xFF34D399),
                        size: 14,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        showBefore ? 'Tu foto original' : 'Look generado con IA',
                        style: TextStyle(
                          color: showBefore ? Colors.white70 : const Color(0xFF34D399),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Botón flotante para Alternar Antes / Después
              Positioned(
                bottom: 12,
                right: 12,
                child: InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    ref.read(tryOnControllerProvider.notifier).toggleBeforeAfter();
                  },
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.compare_rounded,
                          color: showBefore ? const Color(0xFF38BDF8) : Colors.white,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          showBefore ? 'Ver resultado IA' : 'Ver original',
                          style: TextStyle(
                            color: showBefore ? const Color(0xFF38BDF8) : Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          // Barra inferior con datos de la prenda y botón de Guardar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.product.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Talla ${widget.recommendedSize} · Color ${widget.selectedColor}',
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: () => _savePhoto(resultImageUrl),
                  icon: const Icon(Icons.download_rounded, size: 16),
                  label: const Text('Guardar'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.25)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// PASO 4: Selector de Colores Disponibles del Producto
  Widget _buildColorSelector(TryOnState state) {
    final colors = widget.product.colors.isNotEmpty
        ? widget.product.colors
        : ['Color único'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Selecciona el color a probar:',
          style: TextStyle(
            color: Color(0xFFCBD5E1),
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: colors.map((color) {
            final isSelected =
                color.toLowerCase() == widget.selectedColor.toLowerCase();

            // Buscar si ya tenemos resultado en caché para este color
            int? colId;
            try {
              final v = widget.product.variants.firstWhere(
                (varItem) => varItem.color.toLowerCase() == color.toLowerCase(),
              );
              colId = v.colorId;
            } catch (_) {}

            final hasCachedResult =
                colId != null && state.cachedResultsByColor.containsKey(colId);

            return InkWell(
              onTap: () {
                HapticFeedback.selectionClick();
                widget.onColorChanged(color);

                // Si ya fue generado previamente, cargar instantáneamente
                if (hasCachedResult && colId != null) {
                  ref.read(tryOnControllerProvider.notifier).startTryOn(
                        productId: widget.product.id,
                        imagePath: state.sessionPhotoPath ?? '',
                        colorId: colId,
                        colorName: color,
                      );
                }
              },
              borderRadius: BorderRadius.circular(20),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.cobalt
                      : Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected
                        ? const Color(0xFF60A5FA)
                        : Colors.white.withValues(alpha: 0.15),
                    width: isSelected ? 1.5 : 1.0,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      color,
                      style: TextStyle(
                        color: isSelected ? Colors.white : const Color(0xFFCBD5E1),
                        fontSize: 12.5,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                      ),
                    ),
                    if (hasCachedResult) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.check_rounded, color: Color(0xFF34D399), size: 14),
                    ],
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildErrorBanner(String error) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              error,
              style: const TextStyle(color: Colors.white, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  /// Barra Inferior Flotante de Acciones
  Widget _buildBottomActionBar(
    TryOnState state,
    bool hasPhoto,
    bool isProcessing,
    bool hasCompleted,
  ) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
      ),
      child: SafeArea(
        top: false,
        child: hasCompleted
            // Estado Completado: Botón para Añadir al Carrito y Re-probar
            ? Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: isProcessing ? null : _generateLook,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Re-generar'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _isAddingToCart ? null : _handleAddToCart,
                      icon: _isAddingToCart
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.add_shopping_cart_rounded, size: 20),
                      label: Text(
                        _isAddingToCart
                            ? 'Añadiendo...'
                            : 'Añadir al Carrito (Talla ${widget.recommendedSize})',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                ],
              )
            // Estado Inicial: Botón para Generar Look con IA
            : FilledButton.icon(
                onPressed: (hasPhoto && !isProcessing) ? _generateLook : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.cobalt,
                  disabledBackgroundColor: Colors.white.withValues(alpha: 0.12),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: const Icon(Icons.auto_awesome, size: 20),
                label: Text(
                  hasPhoto
                      ? 'Generar Look con IA (${widget.selectedColor})'
                      : 'Selecciona una foto primero',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
      ),
    );
  }
}
