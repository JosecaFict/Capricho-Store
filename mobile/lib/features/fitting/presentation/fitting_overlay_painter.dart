import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class FittingOverlayPainter extends CustomPainter {
  const FittingOverlayPainter({
    required this.scaleMultiplier,
    this.shoulderDistanceRatio = 0.55,
    this.showGuides = true,
    this.isScanning = false,
    this.scanLinePosition = 0.0,
    this.isLocked = false,
  });

  final double scaleMultiplier; // e.g. 1.0 for M, 1.08 for L
  final double shoulderDistanceRatio;
  final bool showGuides;
  final bool isScanning;
  final double scanLinePosition; // 0.0 a 1.0
  final bool isLocked;

  @override
  void paint(Canvas canvas, Size size) {
    if (!showGuides) return;

    final centerX = size.width / 2;
    final centerY = size.height * 0.40;

    final baseShoulderWidth =
        size.width * shoulderDistanceRatio * scaleMultiplier;
    final leftShoulderX = centerX - (baseShoulderWidth / 2);
    final rightShoulderX = centerX + (baseShoulderWidth / 2);
    final shoulderY = centerY - 50;

    final Color primaryColor = isLocked
        ? const Color(0xFF10B981) // Verde esmeralda al bloquear
        : (isScanning ? const Color(0xFF38BDF8) : AppColors.cobalt);

    // 1. Línea guía de hombros con resplandor
    final guidePaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.75)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    final glowPaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6.0;

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
      ..color = isLocked ? const Color(0xFF34D399) : Colors.amberAccent
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(centerX, shoulderY + 15), 3.5, neckPaint);

    // 4. Caja guía de encuadre de torso
    final torsoRect = Rect.fromCenter(
      center: Offset(centerX, centerY + 40),
      width: baseShoulderWidth * 1.05,
      height: baseShoulderWidth * 1.35,
    );

    final rrect = RRect.fromRectAndRadius(torsoRect, const Radius.circular(20));
    final torsoOutlinePaint = Paint()
      ..color = isScanning
          ? primaryColor.withValues(alpha: 0.35)
          : Colors.white.withValues(alpha: 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawRRect(rrect, torsoOutlinePaint);

    // 5. Brackets HUD en las 4 esquinas de la caja de escaneo
    final bracketPaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;

    const cornerLen = 22.0;

    // Superior Izquierda
    canvas.drawLine(
      Offset(torsoRect.left, torsoRect.top + cornerLen),
      Offset(torsoRect.left, torsoRect.top),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(torsoRect.left, torsoRect.top),
      Offset(torsoRect.left + cornerLen, torsoRect.top),
      bracketPaint,
    );

    // Superior Derecha
    canvas.drawLine(
      Offset(torsoRect.right - cornerLen, torsoRect.top),
      Offset(torsoRect.right, torsoRect.top),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(torsoRect.right, torsoRect.top),
      Offset(torsoRect.right, torsoRect.top + cornerLen),
      bracketPaint,
    );

    // Inferior Izquierda
    canvas.drawLine(
      Offset(torsoRect.left, torsoRect.bottom - cornerLen),
      Offset(torsoRect.left, torsoRect.bottom),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(torsoRect.left, torsoRect.bottom),
      Offset(torsoRect.left + cornerLen, torsoRect.bottom),
      bracketPaint,
    );

    // Inferior Derecha
    canvas.drawLine(
      Offset(torsoRect.right - cornerLen, torsoRect.bottom),
      Offset(torsoRect.right, torsoRect.bottom),
      bracketPaint,
    );
    canvas.drawLine(
      Offset(torsoRect.right, torsoRect.bottom),
      Offset(torsoRect.right, torsoRect.bottom - cornerLen),
      bracketPaint,
    );

    // 6. Rayo Láser / Scanline AR durante el escaneo
    if (isScanning) {
      final currentScanY =
          torsoRect.top + (torsoRect.height * scanLinePosition);

      // Línea central de escaneo
      final laserPaint = Paint()
        ..shader = LinearGradient(
          colors: [
            primaryColor.withValues(alpha: 0.0),
            primaryColor,
            Colors.white,
            primaryColor,
            primaryColor.withValues(alpha: 0.0),
          ],
          stops: const [0.0, 0.2, 0.5, 0.8, 1.0],
        ).createShader(
          Rect.fromLTWH(
            torsoRect.left,
            currentScanY - 2,
            torsoRect.width,
            4,
          ),
        )
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke;

      canvas.drawLine(
        Offset(torsoRect.left, currentScanY),
        Offset(torsoRect.right, currentScanY),
        laserPaint,
      );

      // Resplandor del rayo láser
      final glowLaserPaint = Paint()
        ..color = primaryColor.withValues(alpha: 0.25)
        ..strokeWidth = 8.0
        ..style = PaintingStyle.stroke;

      canvas.drawLine(
        Offset(torsoRect.left + 10, currentScanY),
        Offset(torsoRect.right - 10, currentScanY),
        glowLaserPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant FittingOverlayPainter oldDelegate) {
    return oldDelegate.scaleMultiplier != scaleMultiplier ||
        oldDelegate.shoulderDistanceRatio != shoulderDistanceRatio ||
        oldDelegate.showGuides != showGuides ||
        oldDelegate.isScanning != isScanning ||
        oldDelegate.scanLinePosition != scanLinePosition ||
        oldDelegate.isLocked != isLocked;
  }
}
