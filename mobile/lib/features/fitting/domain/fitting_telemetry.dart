import 'dart:math' as math;

enum AngleGuidance {
  perfect,
  tiltForward,   // Teléfono inclinado hacia atrás (apunta al techo) -> inclinar hacia adelante
  tiltBackward,  // Teléfono inclinado hacia adelante (apunta al piso) -> inclinar hacia atrás
  levelRoll,     // Teléfono chueco hacia un lado
}

enum DistanceGuidance {
  perfect,
  stepBack,    // Muy cerca (< 1.45m)
  stepCloser,  // Muy lejos (> 1.95m)
  searching,   // Silueta no encontrada
}

class DeviceAngleState {
  const DeviceAngleState({
    required this.pitchDegrees,
    required this.rollDegrees,
    required this.isVerticalAligned,
    required this.guidance,
  });

  final double pitchDegrees; // 0° = acostado plano, 90° = vertical recto, >90° = inclinado hacia abajo
  final double rollDegrees;  // Inclinación lateral (- hacia izquierda, + hacia derecha)
  final bool isVerticalAligned;
  final AngleGuidance guidance;

  /// Calcula el ángulo de inclinación vertical y lateral a partir de los datos del acelerómetro
  /// X: lateral, Y: longitudinal (hacia abajo), Z: perpendicular a la pantalla
  factory DeviceAngleState.fromAccelerometer({
    required double x,
    required double y,
    required double z,
  }) {
    // Magnitud longitudinal y perpendicular
    final absY = y.abs();
    
    // Pitch: 0° acostado en mesa, 90° vertical recto hacia el frente
    // atan2(absY, z) mapea:
    // z = 9.8, y = 0 -> 0° (acostado mirando al techo)
    // z = 0, y = -9.8 -> 90° (vertical perfecto)
    // z = -9.8, y = 0 -> 180° (boca abajo)
    double pitch = math.atan2(absY, z) * (180.0 / math.pi);
    if (pitch.isNaN) pitch = 90.0;

    // Roll: inclinación hacia los lados respecto a la vertical
    double roll = math.atan2(x, absY > 0.001 ? absY : 1.0) * (180.0 / math.pi);
    if (roll.isNaN) roll = 0.0;

    // Rango de tolerancia para verticalidad: 87.0° a 93.0°
    const minTargetPitch = 87.0;
    const maxTargetPitch = 93.0;
    const maxRollAllowed = 4.5;

    final isPitchOk = pitch >= minTargetPitch && pitch <= maxTargetPitch;
    final isRollOk = roll.abs() <= maxRollAllowed;
    final isAligned = isPitchOk && isRollOk;

    AngleGuidance guidance = AngleGuidance.perfect;
    if (!isRollOk) {
      guidance = AngleGuidance.levelRoll;
    } else if (pitch < minTargetPitch) {
      guidance = AngleGuidance.tiltForward; // Inclinado mirando hacia arriba
    } else if (pitch > maxTargetPitch) {
      guidance = AngleGuidance.tiltBackward; // Inclinado mirando hacia abajo
    }

    return DeviceAngleState(
      pitchDegrees: pitch,
      rollDegrees: roll,
      isVerticalAligned: isAligned,
      guidance: guidance,
    );
  }

  /// Estado predeterminado perfecto para tests o emuladores
  static const DeviceAngleState alignedDefault = DeviceAngleState(
    pitchDegrees: 90.0,
    rollDegrees: 0.0,
    isVerticalAligned: true,
    guidance: AngleGuidance.perfect,
  );
}

class UserDistanceState {
  const UserDistanceState({
    required this.estimatedDistanceMeters,
    required this.shoulderRatio,
    required this.isDistanceOptimal,
    required this.guidance,
  });

  final double estimatedDistanceMeters;
  final double shoulderRatio; // Ancho de hombros detectado / ancho de pantalla (0.0 a 1.0)
  final bool isDistanceOptimal;
  final DistanceGuidance guidance;

  /// Estima la distancia a partir de la proporción del ancho de hombros respecto a la pantalla
  /// y las medidas biacromiales de referencia (~44 cm)
  factory UserDistanceState.fromShoulderRatio(double ratio) {
    if (ratio <= 0.05) {
      return const UserDistanceState(
        estimatedDistanceMeters: 0.0,
        shoulderRatio: 0.0,
        isDistanceOptimal: false,
        guidance: DistanceGuidance.searching,
      );
    }

    // A ~1.7m de distancia en un smartphone típico en vertical,
    // los hombros ocupan aproximadamente el 42% - 48% del ancho de pantalla.
    // Fórmula empírica estenopeica: Distancia ~ constanteK / ratio
    // con constanteK ~ 0.76 (0.76 / 0.45 = ~1.69 m)
    const constantK = 0.76;
    double meters = (constantK / ratio).clamp(0.8, 3.5);

    // Rango óptimo para pruebas superiores: 1.50m - 1.85m (ratio entre 0.38 y 0.52)
    final isOptimal = meters >= 1.50 && meters <= 1.88;

    DistanceGuidance guidance = DistanceGuidance.perfect;
    if (meters < 1.50) {
      guidance = DistanceGuidance.stepBack;
    } else if (meters > 1.88) {
      guidance = DistanceGuidance.stepCloser;
    }

    return UserDistanceState(
      estimatedDistanceMeters: meters,
      shoulderRatio: ratio,
      isDistanceOptimal: isOptimal,
      guidance: guidance,
    );
  }

  static const UserDistanceState optimalDefault = UserDistanceState(
    estimatedDistanceMeters: 1.70,
    shoulderRatio: 0.45,
    isDistanceOptimal: true,
    guidance: DistanceGuidance.perfect,
  );
}

class FittingTelemetry {
  const FittingTelemetry({
    required this.angle,
    required this.distance,
    required this.isCalibrated,
  });

  final DeviceAngleState angle;
  final UserDistanceState distance;
  final bool isCalibrated; // True cuando ambas condiciones se cumplen simultáneamente

  factory FittingTelemetry.evaluate({
    required DeviceAngleState angle,
    required UserDistanceState distance,
  }) {
    final ready = angle.isVerticalAligned && distance.isDistanceOptimal;
    return FittingTelemetry(
      angle: angle,
      distance: distance,
      isCalibrated: ready,
    );
  }

  String get guidanceHeadline {
    if (isCalibrated) {
      return '¡Encuadre Óptimo! Mantén la postura';
    }
    if (!angle.isVerticalAligned) {
      switch (angle.guidance) {
        case AngleGuidance.tiltForward:
          return 'Endereza el iPhone (inclinado hacia atrás)';
        case AngleGuidance.tiltBackward:
          return 'Inclina el iPhone hacia ti (está hacia abajo)';
        case AngleGuidance.levelRoll:
          return 'Nivela el iPhone recto';
        case AngleGuidance.perfect:
          break;
      }
    }
    switch (distance.guidance) {
      case DistanceGuidance.stepBack:
        return 'Aléjate un paso (distancia actual: ${distance.estimatedDistanceMeters.toStringAsFixed(1)}m)';
      case DistanceGuidance.stepCloser:
        return 'Acércate un poco (distancia actual: ${distance.estimatedDistanceMeters.toStringAsFixed(1)}m)';
      case DistanceGuidance.searching:
        return 'Párate frente a la cámara (~1.7m)';
      case DistanceGuidance.perfect:
        return 'Alineando posición...';
    }
  }
}
