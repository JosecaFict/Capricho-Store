import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class FittingOverlayPainter extends CustomPainter {
  const FittingOverlayPainter({
    required this.scaleMultiplier,
    this.shoulderDistanceRatio = 0.55,
    this.showGuides = true,
  });

  final double scaleMultiplier; // e.g. 1.0 for M, 1.08 for L
  final double shoulderDistanceRatio;
  final bool showGuides;

  @override
  void paint(Canvas canvas, Size size) {
    if (!showGuides) return;

    final centerX = size.width / 2;
    final centerY = size.height * 0.40; // Altura aproximada del torso superior

    final baseShoulderWidth = size.width * shoulderDistanceRatio * scaleMultiplier;
    final leftShoulderX = centerX - (baseShoulderWidth / 2);
    final rightShoulderX = centerX + (baseShoulderWidth / 2);
    final shoulderY = centerY - 50;

    // Pinturas para guías de Realidad Aumentada
    final guidePaint = Paint()
      ..color = AppColors.cobalt.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    final glowPaint = Paint()
      ..color = AppColors.cobalt.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6.0;

    // 1. Línea guía de hombros con puntos de anclaje (Targeting reticle)
    canvas.drawLine(
      Offset(leftShoulderX, shoulderY),
      Offset(rightShoulderX, shoulderY),
      glowPaint,
    );
    canvas.drawLine(
      Offset(leftShoulderX, shoulderY),
      Offset(rightShoulderX, shoulderY),
      guidePaint,
    );

    // 2. Marcadores en hombro izquierdo y derecho
    final markerPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(leftShoulderX, shoulderY), 5.0, markerPaint);
    canvas.drawCircle(Offset(leftShoulderX, shoulderY), 7.0, guidePaint);

    canvas.drawCircle(Offset(rightShoulderX, shoulderY), 5.0, markerPaint);
    canvas.drawCircle(Offset(rightShoulderX, shoulderY), 7.0, guidePaint);

    // 3. Indicador de cuello / centrado
    final neckPaint = Paint()
      ..color = Colors.amberAccent
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(centerX, shoulderY + 15), 3.5, neckPaint);

    // 4. Silueta suave de torso (caja guía de encuadre)
    final torsoRect = Rect.fromCenter(
      center: Offset(centerX, centerY + 40),
      width: baseShoulderWidth * 1.05,
      height: baseShoulderWidth * 1.35,
    );

    final rrect = RRect.fromRectAndRadius(torsoRect, const Radius.circular(20));
    final torsoOutlinePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawRRect(rrect, torsoOutlinePaint);
  }

  @override
  bool shouldRepaint(covariant FittingOverlayPainter oldDelegate) {
    return oldDelegate.scaleMultiplier != scaleMultiplier ||
        oldDelegate.shoulderDistanceRatio != shoulderDistanceRatio ||
        oldDelegate.showGuides != showGuides;
  }
}
