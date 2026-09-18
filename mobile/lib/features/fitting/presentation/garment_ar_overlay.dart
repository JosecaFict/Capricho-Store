import 'package:cached_network_image/cached_network_image.dart';
import 'package:capricho_store/features/fitting/domain/pose_smoother.dart';
import 'package:flutter/material.dart';

/// Widget de superposición AR dinámico (Hito 5.2).
///
/// Ancla la prenda fotográfica exactamente sobre la anatomía detectada por
/// Apple Vision (cuello y hombros) y rota dinámicamente con la inclinación corporal.
class GarmentArOverlay extends StatelessWidget {
  const GarmentArOverlay({
    super.key,
    required this.imageUrl,
    required this.pose,
    this.opacity = 0.92,
    this.fallbackIcon = Icons.checkroom_rounded,
  });

  final String? imageUrl;
  final SmoothedPose pose;
  final double opacity;
  final IconData fallbackIcon;

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;

    // 1. Convertir coordenadas normalizadas (0.0 a 1.0) a píxeles de pantalla
    final neckPixelX = pose.neck.dx * screenSize.width;
    final neckPixelY = pose.neck.dy * screenSize.height;

    // 2. Ancho proporcional de la polera ajustado por escala de talla
    // Un ancho de hombros estándar ocupa ~60-70% del ancho del torso
    final baseWidth = (pose.shoulderRatio * screenSize.width * 1.38)
        .clamp(screenSize.width * 0.52, screenSize.width * 0.88);
    final garmentWidth = baseWidth * pose.scaleMultiplier;
    final garmentHeight = garmentWidth * 1.18; // Proporción natural de polera

    // 3. Punto de anclaje: el centro del cuello de la polera está a ~12% de la parte superior
    final collarAnchorX = garmentWidth / 2.0;
    final collarAnchorY = garmentHeight * 0.12;

    final leftPosition = neckPixelX - collarAnchorX;
    final topPosition = neckPixelY - collarAnchorY;

    return Positioned(
      left: leftPosition,
      top: topPosition,
      width: garmentWidth,
      height: garmentHeight,
      child: Transform.rotate(
        angle: pose.shoulderAngle,
        origin: Offset(collarAnchorX, collarAnchorY),
        child: AnimatedOpacity(
          opacity: opacity,
          duration: const Duration(milliseconds: 180),
          child: Container(
            decoration: BoxDecoration(
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.38),
                  blurRadius: 20,
                  spreadRadius: 2,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: imageUrl != null && imageUrl!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: imageUrl!,
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
      ),
    );
  }
}
