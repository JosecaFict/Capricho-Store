import 'dart:ui';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/features/fitting/domain/fitting_engine.dart';
import 'package:capricho_store/features/fitting/domain/pose_smoother.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FittingEngine Tests', () {
    final sampleMeasurements = [
      const ProductMeasurement(
        id: 1,
        size: 'S',
        shouldersCm: 41.0,
        chestCm: 92.0,
        lengthCm: 68.0,
        sleeveCm: 20.0,
      ),
      const ProductMeasurement(
        id: 2,
        size: 'M',
        shouldersCm: 44.0,
        chestCm: 98.0,
        lengthCm: 71.0,
        sleeveCm: 21.0,
      ),
      const ProductMeasurement(
        id: 3,
        size: 'L',
        shouldersCm: 47.0,
        chestCm: 104.0,
        lengthCm: 74.0,
        sleeveCm: 22.0,
      ),
    ];

    test('recomienda talla M directamente para hombros de 44cm', () {
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 44.0,
      );

      expect(rec.recommendedSize, 'M');
      expect(rec.confidence, greaterThanOrEqualTo(90));
      expect(rec.sizeScales['M'], 1.0);
      expect(rec.sizeScales['L'], greaterThan(1.0));
      expect(rec.sizeScales['S'], lessThan(1.0));
      expect(rec.isBorderline, isFalse);
    });

    test('detecta talla frontera entre M y L a 45.5cm', () {
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 45.5,
      );

      expect(rec.isBorderline, isTrue);
      expect(rec.alternativeSize, isNotNull);
      expect(['M', 'L'], contains(rec.recommendedSize));
      expect(['M', 'L'], contains(rec.alternativeSize));
    });

    test('aplica calibración femenina correctamente en ausencia de tabla', () {
      final rec = FittingEngine.evaluate(
        measurements: [],
        availableSizes: ['S', 'M', 'L', 'XL'],
        userShouldersCm: 38.0,
        gender: 'MUJER',
      );

      expect(rec.recommendedSize, 'M');
      expect(rec.gender, 'MUJER');
      expect(rec.confidence, greaterThanOrEqualTo(90));
    });

    test('recomienda talla S para contextura delgada (40.5cm)', () {
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 40.5,
      );

      expect(rec.recommendedSize, 'S');
      expect(rec.confidence, greaterThanOrEqualTo(90));
    });

    test('compensa con Talla L para persona que subio de peso (BodyBuild.full) con hombros de 44cm', () {
      // Hombros base de 44cm normalmente recomiendan M, pero contextura robusta compensa a L
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L', 'XL'],
        userShouldersCm: 44.0,
        bodyBuild: BodyBuild.full,
      );

      expect(rec.recommendedSize, 'L');
      expect(rec.bodyBuild, BodyBuild.full);
      expect(rec.verdict, contains('Talla L recomendada'));
      expect(rec.verdict, contains('volumen en tórax y abdomen'));
    });

    test('favorece talla entallada para BodyBuild.slim en talla limite', () {
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 42.5, // Entre S (41) y M (44)
        bodyBuild: BodyBuild.slim,
      );

      expect(rec.recommendedSize, 'S');
      expect(rec.bodyBuild, BodyBuild.slim);
    });

    test('retorna fallback cuando no hay tallas disponibles', () {
      final rec = FittingEngine.evaluate(
        measurements: [],
        availableSizes: [],
      );

      expect(rec.recommendedSize, 'M');
      expect(rec.confidence, 85);
    });
  });

  group('PoseSmoother EMA Tests', () {
    test('inicializa valores en la primera llamada', () {
      final smoother = PoseSmoother(alpha: 0.35);
      expect(smoother.isInitialized, isFalse);

      final pose = smoother.update(
        neck: const Offset(0.5, 0.3),
        shoulderAngle: 0.05,
        shoulderRatio: 0.45,
        scaleMultiplier: 1.0,
      );

      expect(smoother.isInitialized, isTrue);
      expect(pose.neck, const Offset(0.5, 0.3));
      expect(pose.shoulderAngle, 0.05);
      expect(pose.shoulderRatio, 0.45);
    });

    test('suaviza variaciones abruptas de forma gradual', () {
      final smoother = PoseSmoother(alpha: 0.35);
      smoother.update(
        neck: const Offset(0.5, 0.3),
        shoulderAngle: 0.0,
        shoulderRatio: 0.40,
      );

      // Simular un salto repentino en un fotograma ruidoso
      final smoothed = smoother.update(
        neck: const Offset(0.6, 0.4),
        shoulderAngle: 0.2,
        shoulderRatio: 0.50,
      );

      // El valor suavizado no debe saltar directamente a 0.6 sino a 0.35 * 0.6 + 0.65 * 0.5 = 0.535
      expect(smoothed.neck.dx, closeTo(0.535, 0.001));
      expect(smoothed.neck.dy, closeTo(0.335, 0.001));
      expect(smoothed.shoulderAngle, closeTo(0.07, 0.001));
      expect(smoothed.shoulderRatio, closeTo(0.435, 0.001));
    });
  });
}
