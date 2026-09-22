import 'package:cached_network_image/cached_network_image.dart';
import 'package:capricho_store/features/fitting/domain/pose_smoother.dart';
import 'package:flutter/material.dart';

/// Widget de superposición AR dinámico y calibrado (Hito 5.2).
///
/// 1. Elimina fondos blancos mediante optimización transparente de Cloudinary (e_make_transparent,f_png).
/// 2. Ancla la prenda fotográfica exactamente sobre la línea de hombros y cuello anatómico.
/// 3. Escala el ancho de la prenda y mangas proporcionalmente al ancho del torso y hombros detectados.
class GarmentArOverlay extends StatelessWidget {
  const GarmentArOverlay({
    super.key,
    required this.imageUrl,
    required this.pose,
    this.opacity = 0.94,
    this.fallbackIcon = Icons.checkroom_rounded,
  });

  final String? imageUrl;
  final SmoothedPose pose;
  final double opacity;
  final IconData fallbackIcon;

  /// Transforma dinámicamente URLs de Cloudinary para remover el fondo blanco sólido
  /// convirtiéndolo en un PNG con transparencia alfa (e_make_transparent:22,f_png).
  static String? optimizeArImageUrl(String? originalUrl) {
    if (originalUrl == null || originalUrl.isEmpty) return null;
    if (originalUrl.contains('res.cloudinary.com') && originalUrl.contains('/upload/')) {
      if (!originalUrl.contains('e_make_transparent') && !originalUrl.contains('e_background_removal')) {
        return originalUrl.replaceFirst('/upload/', '/upload/e_make_transparent:22,f_png/');
      }
    }
    return originalUrl;
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;

    final centerX = screenSize.width / 2.0;
    final centerY = screenSize.height * 0.44;
    final defaultShoulderY = centerY - 45.0;

    // 1. Coordenadas del cuello: usar cuello detectado acotado al rango natural del torso
    final bool isNeckCentered = pose.neck.dx >= 0.25 &&
        pose.neck.dx <= 0.75 &&
        pose.neck.dy >= 0.15 &&
        pose.neck.dy <= 0.65;

    final neckPixelX = isNeckCentered
        ? pose.neck.dx * screenSize.width
        : centerX;

    // El cuello anatómico / clavícula se alinea con la línea de hombros (defaultShoulderY)
    final neckPixelY = isNeckCentered
        ? (pose.neck.dy * screenSize.height).clamp(defaultShoulderY - 20.0, defaultShoulderY + 10.0)
        : defaultShoulderY;

    // 2. Ancho proporcional de la prenda:
    // El ancho base de hombros es 32% del ancho de pantalla (coincide con la línea verde HOMBRO IZQ - HOMBRO DER).
    // Una polera incluye mangas en los costados (~1.36x del ancho biacromial).
    final baseShoulderWidth = screenSize.width * 0.32;
    final garmentWidth = baseShoulderWidth * 1.36 * pose.scaleMultiplier;
    final garmentHeight = garmentWidth * 1.24; // Proporción natural de torso y cintura

    // 3. Punto de anclaje: el centro del cuello/collar de la prenda está al ~8% superior
    final collarAnchorX = garmentWidth / 2.0;
    final collarAnchorY = garmentHeight * 0.08;

    final leftPosition = neckPixelX - collarAnchorX;
    // Anclamos el cuello de la prenda exactamente sobre la línea de hombros
    final topPosition = neckPixelY - collarAnchorY;

    // Ángulo seguro: limitar inclinaciones corporales a ±25°
    final safeAngle = (pose.shoulderAngle.abs() < 0.45) ? pose.shoulderAngle : 0.0;

    final finalImageUrl = optimizeArImageUrl(imageUrl);

    return Positioned(
      left: leftPosition,
      top: topPosition,
      width: garmentWidth,
      height: garmentHeight,
      child: Transform.rotate(
        angle: safeAngle,
        origin: Offset(collarAnchorX, collarAnchorY),
        child: AnimatedOpacity(
          opacity: opacity,
          duration: const Duration(milliseconds: 180),
          child: finalImageUrl != null && finalImageUrl.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: finalImageUrl,
                  fit: BoxFit.contain,
                  placeholder: (_, __) => const SizedBox(),
                  errorWidget: (_, __, ___) => Center(
                    child: Icon(
                      fallbackIcon,
                      size: 90,
                      color: Colors.white70,
                    ),
                  ),
                )
              : Center(
                  child: Icon(
                    fallbackIcon,
                    size: 90,
                    color: Colors.white70,
                  ),
                ),
        ),
      ),
    );
  }
}
