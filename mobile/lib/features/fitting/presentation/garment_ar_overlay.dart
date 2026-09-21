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

    final centerX = screenSize.width / 2.0;
    final centerY = screenSize.height * 0.44;
    final defaultShoulderY = centerY - 45.0;

    // 1. Coordenadas del cuello: usar cuello detectado si está centrado en el encuadre (0.25 - 0.75),
    // o anclar al centro natural de la silueta del vestidor (centerX, shoulderY)
    final bool isNeckCentered = pose.neck.dx >= 0.25 &&
        pose.neck.dx <= 0.75 &&
        pose.neck.dy >= 0.15 &&
        pose.neck.dy <= 0.65;

    final neckPixelX = isNeckCentered
        ? pose.neck.dx * screenSize.width
        : centerX;
    final neckPixelY = isNeckCentered
        ? pose.neck.dy * screenSize.height
        : (defaultShoulderY + 8);

    // 2. Ancho proporcional de la prenda regular alineado con la silueta (~38% del ancho de pantalla)
    final baseWidth = screenSize.width * 0.38;
    final garmentWidth = baseWidth * pose.scaleMultiplier;
    final garmentHeight = garmentWidth * 1.25; // Proporción natural de polera

    // 3. Punto de anclaje: el centro del cuello de la polera está a ~10% de la parte superior
    final collarAnchorX = garmentWidth / 2.0;
    final collarAnchorY = garmentHeight * 0.10;

    final leftPosition = neckPixelX - collarAnchorX;
    final topPosition = neckPixelY - collarAnchorY;

    // Ángulo seguro: limitar inclinaciones corporales a ±25° (evitar rotaciones de 90° por sensor)
    final safeAngle = (pose.shoulderAngle.abs() < 0.45) ? pose.shoulderAngle : 0.0;

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
