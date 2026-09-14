import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/features/fitting/domain/fitting_engine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FittingEngine Tests', () {
    final sampleMeasurements = [
      const ProductMeasurement(
        size: 'S',
        shouldersCm: 41.0,
        chestCm: 92.0,
        lengthCm: 68.0,
        sleeveLengthCm: 20.0,
      ),
      const ProductMeasurement(
        size: 'M',
        shouldersCm: 44.0,
        chestCm: 98.0,
        lengthCm: 71.0,
        sleeveLengthCm: 21.0,
      ),
      const ProductMeasurement(
        size: 'L',
        shouldersCm: 47.0,
        chestCm: 104.0,
        lengthCm: 74.0,
        sleeveLengthCm: 22.0,
      ),
    ];

    test('recomienda talla M con alta confianza para hombros de 44cm', () {
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 44.0,
      );

      expect(rec.recommendedSize, 'M');
      expect(rec.confidence, greaterThanOrEqualTo(90));
      expect(rec.alternativeSize, 'L');
      expect(rec.alternativeNote, contains('look holgado / oversize'));
      expect(rec.sizeScales['M'], 1.0);
      expect(rec.sizeScales['L'], greaterThan(1.0));
      expect(rec.sizeScales['S'], lessThan(1.0));
    });

    test('recomienda talla L para hombros más anchos (47.5cm)', () {
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 47.5,
      );

      expect(rec.recommendedSize, 'L');
      expect(rec.confidence, greaterThanOrEqualTo(90));
    });

    test('recomienda talla S para contextura delgada (40.5cm)', () {
      final rec = FittingEngine.evaluate(
        measurements: sampleMeasurements,
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 40.5,
      );

      expect(rec.recommendedSize, 'S');
      expect(rec.alternativeSize, 'M');
    });

    test('maneja lista vacía de medidas usando hombros estándar', () {
      final rec = FittingEngine.evaluate(
        measurements: [],
        availableSizes: ['S', 'M', 'L'],
        userShouldersCm: 44.0,
      );

      expect(rec.recommendedSize, 'M');
      expect(rec.confidence, isNotNull);
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
}
