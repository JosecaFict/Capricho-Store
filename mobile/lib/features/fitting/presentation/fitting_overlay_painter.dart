import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class FittingOverlayPainter extends CustomPainter {
  const FittingOverlayPainter({
    required this.scaleMultiplier,
    this.shoulderDistanceRatio = 0.32,
    this.showGuides = true,
    this.isScanning = false,
    this.scanLinePosition = 0.0,
    this.isLocked = false,
    this.pitchDegrees = 90.0,
    this.rollDegrees = 0.0,
    this.isAngleOk = true,
    this.estimatedDistanceMeters = 1.7,
    this.isDistanceOk = true,
    this.isCalibrated = true,
    this.guidanceHeadline = '',
  });

  final double scaleMultiplier; // e.g. 1.0 for M, 1.08 for L
  final double shoulderDistanceRatio;
  final bool showGuides;
  final bool isScanning;
  final double scanLinePosition; // 0.0 a 1.0
  final bool isLocked;
  final double pitchDegrees;
  final double rollDegrees;
  final bool isAngleOk;
  final double estimatedDistanceMeters;
  final bool isDistanceOk;
  final bool isCalibrated;
  final String guidanceHeadline;

  @override
  void paint(Canvas canvas, Size size) {
    if (!showGuides) return;

    final centerX = size.width / 2;
    final centerY = size.height * 0.44;

    final baseShoulderWidth =
        size.width * shoulderDistanceRatio * scaleMultiplier;
    final leftShoulderX = centerX - (baseShoulderWidth / 2);
    final rightShoulderX = centerX + (baseShoulderWidth / 2);
    final shoulderY = centerY - 45;

    // Colores de estado reactivos
    final Color primaryColor = isCalibrated || isLocked
        ? const Color(0xFF10B981) // Verde esmeralda (Encuadre y ángulo perfecto)
        : (!isAngleOk
            ? const Color(0xFFF59E0B) // Ámbar/Naranja (Ángulo desalineado)
            : (isScanning ? const Color(0xFF38BDF8) : AppColors.cobalt));

    // 1. Silueta Fantasma: Contorno anatómico de Cabeza (ARRIBA de los hombros)
    final headCenterY = shoulderY - 68;
    final headRadiusX = baseShoulderWidth * 0.28;
    final headRadiusY = baseShoulderWidth * 0.38;
    final headRect = Rect.fromCenter(
      center: Offset(centerX, headCenterY),
      width: headRadiusX * 2,
      height: headRadiusY * 2,
    );

    final headPaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;

    final headFillPaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.04)
      ..style = PaintingStyle.fill;

    canvas.drawOval(headRect, headFillPaint);
    canvas.drawOval(headRect, headPaint);

    // Etiqueta indicativa "CABEZA" en el contorno superior
    _drawTextBadge(
      canvas,
      text: '👤 CABEZA',
      center: Offset(centerX, headCenterY - headRadiusY - 10),
      color: primaryColor,
    );

    // 2. Curvas de Trapecio / Cuello anatómico hacia los hombros
    final neckBaseY = shoulderY - 16;
    final neckHalfWidth = baseShoulderWidth * 0.14;

    final trapeziusPath = Path()
      ..moveTo(centerX - neckHalfWidth, neckBaseY)
      ..quadraticBezierTo(
        leftShoulderX + (baseShoulderWidth * 0.15),
        shoulderY - 8,
        leftShoulderX,
        shoulderY,
      );

    final rightTrapeziusPath = Path()
      ..moveTo(centerX + neckHalfWidth, neckBaseY)
      ..quadraticBezierTo(
        rightShoulderX - (baseShoulderWidth * 0.15),
        shoulderY - 8,
        rightShoulderX,
        shoulderY,
      );

    final slopePaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.70)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    canvas.drawPath(trapeziusPath, slopePaint);
    canvas.drawPath(rightTrapeziusPath, slopePaint);

    // 3. Línea guía de hombros con resplandor
    final guidePaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.90)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4;

    final glowPaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7.0;

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

    // 4. Marcadores en hombro izquierdo y derecho con etiquetas
    final markerPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(leftShoulderX, shoulderY), 5.5, markerPaint);
    canvas.drawCircle(Offset(leftShoulderX, shoulderY), 8.0, guidePaint);

    canvas.drawCircle(Offset(rightShoulderX, shoulderY), 5.5, markerPaint);
    canvas.drawCircle(Offset(rightShoulderX, shoulderY), 8.0, guidePaint);

    // Etiquetas indicativas de hombros
    _drawTextBadge(
      canvas,
      text: 'HOMBRO IZQ',
      center: Offset(leftShoulderX - 28, shoulderY - 14),
      color: primaryColor,
    );
    _drawTextBadge(
      canvas,
      text: 'HOMBRO DER',
      center: Offset(rightShoulderX + 28, shoulderY - 14),
      color: primaryColor,
    );

    // 5. Indicador de base del cuello / collar
    final neckDotPaint = Paint()
      ..color = isCalibrated ? const Color(0xFF34D399) : Colors.amberAccent
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(centerX, shoulderY + 8), 4.0, neckDotPaint);

    // 6. Caja guía de encuadre de torso (desde clavículas a cintura)
    final torsoRect = Rect.fromCenter(
      center: Offset(centerX, centerY + 38),
      width: baseShoulderWidth * 1.08,
      height: baseShoulderWidth * 1.45,
    );

    final rrect = RRect.fromRectAndRadius(torsoRect, const Radius.circular(22));
    final torsoOutlinePaint = Paint()
      ..color = isScanning || isCalibrated
          ? primaryColor.withValues(alpha: 0.35)
          : Colors.white.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;

    canvas.drawRRect(rrect, torsoOutlinePaint);

    // Etiqueta del Torso
    _drawTextBadge(
      canvas,
      text: 'TORSO (PECHO Y CINTURA)',
      center: Offset(centerX, torsoRect.bottom + 12),
      color: primaryColor,
    );

    // 7. Brackets HUD en las 4 esquinas de la caja de escaneo
    final bracketPaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;

    const cornerLen = 24.0;

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

    // 6. Nivelador digital de inclinación (Crosshair horizontal en el centro)
    final levelPaint = Paint()
      ..color = isAngleOk
          ? const Color(0xFF10B981).withValues(alpha: 0.6)
          : const Color(0xFFF59E0B).withValues(alpha: 0.8)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    // Inclinación por roll (rotación leve de la cruz si está ladeado)
    final horizonY = torsoRect.bottom + 18;
    canvas.save();
    canvas.translate(centerX, horizonY);
    canvas.rotate((rollDegrees * 3.1415926535) / 180.0);
    canvas.drawLine(const Offset(-32, 0), const Offset(32, 0), levelPaint);
    canvas.drawCircle(Offset.zero, 3.0, Paint()..color = levelPaint.color);
    canvas.restore();

    // 7. Rayo Láser / Scanline AR durante el escaneo
    if (isScanning) {
      final currentScanY =
          torsoRect.top + (torsoRect.height * scanLinePosition);

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

  void _drawTextBadge(
    Canvas canvas, {
    required String text,
    required Offset center,
    required Color color,
  }) {
    final textSpan = TextSpan(
      text: text,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 9.5,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
      ),
    );
    final textPainter = TextPainter(
      text: textSpan,
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();

    final bgRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: center,
        width: textPainter.width + 12,
        height: textPainter.height + 6,
      ),
      const Radius.circular(4),
    );

    final bgPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.65)
      ..style = PaintingStyle.fill;
    final borderPaint = Paint()
      ..color = color.withValues(alpha: 0.70)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    canvas.drawRRect(bgRect, bgPaint);
    canvas.drawRRect(bgRect, borderPaint);

    textPainter.paint(
      canvas,
      Offset(center.dx - textPainter.width / 2, center.dy - textPainter.height / 2),
    );
  }

  @override
  bool shouldRepaint(covariant FittingOverlayPainter oldDelegate) {
    return oldDelegate.scaleMultiplier != scaleMultiplier ||
        oldDelegate.shoulderDistanceRatio != shoulderDistanceRatio ||
        oldDelegate.showGuides != showGuides ||
        oldDelegate.isScanning != isScanning ||
        oldDelegate.scanLinePosition != scanLinePosition ||
        oldDelegate.isLocked != isLocked ||
        oldDelegate.pitchDegrees != pitchDegrees ||
        oldDelegate.rollDegrees != rollDegrees ||
        oldDelegate.isAngleOk != isAngleOk ||
        oldDelegate.estimatedDistanceMeters != estimatedDistanceMeters ||
        oldDelegate.isDistanceOk != isDistanceOk ||
        oldDelegate.isCalibrated != isCalibrated ||
        oldDelegate.guidanceHeadline != guidanceHeadline;
  }
}

