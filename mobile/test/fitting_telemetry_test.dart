import 'package:capricho_store/features/fitting/domain/fitting_telemetry.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FittingTelemetry DeviceAngleState Tests', () {
    test('detecta verticalidad perfecta a 90 grados (y = -9.8, z = 0)', () {
      final state = DeviceAngleState.fromAccelerometer(x: 0.0, y: -9.81, z: 0.0);

      expect(state.pitchDegrees, closeTo(90.0, 0.5));
      expect(state.rollDegrees, closeTo(0.0, 0.5));
      expect(state.isVerticalAligned, isTrue);
      expect(state.guidance, AngleGuidance.perfect);
    });

    test('detecta teléfono recostado hacia atrás en una mesa (pitch < 87°)', () {
      // Por ejemplo apoyado a 60° (z positivo alto)
      final state = DeviceAngleState.fromAccelerometer(x: 0.0, y: -8.5, z: 4.9);

      expect(state.pitchDegrees, closeTo(60.0, 1.0));
      expect(state.isVerticalAligned, isFalse);
      expect(state.guidance, AngleGuidance.tiltForward);
    });

    test('detecta teléfono inclinado hacia adelante apuntando al piso (pitch > 93°)', () {
      // z negativo
      final state = DeviceAngleState.fromAccelerometer(x: 0.0, y: -8.5, z: -4.9);

      expect(state.pitchDegrees, closeTo(120.0, 1.0));
      expect(state.isVerticalAligned, isFalse);
      expect(state.guidance, AngleGuidance.tiltBackward);
    });

    test('detecta teléfono chueco a la derecha (roll alto)', () {
      final state = DeviceAngleState.fromAccelerometer(x: 3.5, y: -9.0, z: 0.0);

      expect(state.rollDegrees.abs(), greaterThan(15.0));
      expect(state.isVerticalAligned, isFalse);
      expect(state.guidance, AngleGuidance.levelRoll);
    });
  });

  group('FittingTelemetry UserDistanceState Tests', () {
    test('detecta distancia óptima para ratio de hombros ~0.45 (~1.69m)', () {
      final state = UserDistanceState.fromShoulderRatio(0.45);

      expect(state.estimatedDistanceMeters, closeTo(1.69, 0.05));
      expect(state.isDistanceOptimal, isTrue);
      expect(state.guidance, DistanceGuidance.perfect);
    });

    test('detecta cuando el usuario está muy cerca (ratio 0.65 -> ~1.17m)', () {
      final state = UserDistanceState.fromShoulderRatio(0.65);

      expect(state.estimatedDistanceMeters, lessThan(1.50));
      expect(state.isDistanceOptimal, isFalse);
      expect(state.guidance, DistanceGuidance.stepBack);
    });

    test('detecta cuando el usuario está muy lejos (ratio 0.28 -> ~2.71m)', () {
      final state = UserDistanceState.fromShoulderRatio(0.28);

      expect(state.estimatedDistanceMeters, greaterThan(1.88));
      expect(state.isDistanceOptimal, isFalse);
      expect(state.guidance, DistanceGuidance.stepCloser);
    });
  });

  group('FittingTelemetry Combined Calibration Tests', () {
    test('calibración es exitosa solo cuando ángulo y distancia son óptimos', () {
      final angleOk = DeviceAngleState.fromAccelerometer(x: 0.0, y: -9.81, z: 0.0);
      final distOk = UserDistanceState.fromShoulderRatio(0.44);

      final telemetry = FittingTelemetry.evaluate(angle: angleOk, distance: distOk);
      expect(telemetry.isCalibrated, isTrue);
      expect(telemetry.guidanceHeadline, contains('¡Encuadre Óptimo!'));
    });

    test('falla la calibración si el ángulo está chueco aunque la distancia esté bien', () {
      final angleBad = DeviceAngleState.fromAccelerometer(x: 0.0, y: -6.0, z: 7.0); // ~40°
      final distOk = UserDistanceState.fromShoulderRatio(0.44);

      final telemetry = FittingTelemetry.evaluate(angle: angleBad, distance: distOk);
      expect(telemetry.isCalibrated, isFalse);
      expect(telemetry.guidanceHeadline, contains('Endereza'));
    });
  });
}
