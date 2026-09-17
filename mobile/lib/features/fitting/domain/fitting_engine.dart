import 'package:capricho_store/features/catalog/domain/catalog_models.dart';

class FittingRecommendation {
  const FittingRecommendation({
    required this.recommendedSize,
    required this.confidence,
    required this.verdict,
    this.estimatedShouldersCm = 44.0,
    this.sizeScales = const {},
  });

  final String recommendedSize;
  final int confidence; // 0 - 100
  final String verdict;
  final double estimatedShouldersCm;
  final Map<String, double> sizeScales;
}

class FittingEngine {
  /// Tamaños de hombros estándar de referencia (cm) si la prenda no tiene medidas explícitas
  static const Map<String, double> _standardShoulders = {
    'XS': 38.0,
    'S': 41.0,
    'M': 44.0,
    'L': 47.0,
    'XL': 50.0,
    'XXL': 53.0,
    '3XL': 56.0,
  };

  /// Factores de escala visual relativa para cada talla en el vestidor
  static const Map<String, double> _defaultScales = {
    'XS': 0.88,
    'S': 0.94,
    'M': 1.00,
    'L': 1.07,
    'XL': 1.15,
    'XXL': 1.22,
    '3XL': 1.30,
  };

  /// Calcula directamente la talla óptima de la polera comparando las medidas de hombros.
  static FittingRecommendation evaluate({
    required List<ProductMeasurement> measurements,
    required List<String> availableSizes,
    double userShouldersCm = 44.0,
  }) {
    if (availableSizes.isEmpty) {
      return const FittingRecommendation(
        recommendedSize: 'M',
        confidence: 85,
        verdict: 'Talla estándar recomendada',
      );
    }

    // Mapa de medidas de la prenda indexado por talla
    final measurementMap = <String, ProductMeasurement>{};
    for (final m in measurements) {
      measurementMap[m.size.toUpperCase()] = m;
    }

    String bestSize = availableSizes.first;
    double minDiff = 999.0;
    int bestConfidence = 90;

    for (final size in availableSizes) {
      final sizeUpper = size.toUpperCase();
      final garmentShoulders = measurementMap[sizeUpper]?.shouldersCm ??
          _standardShoulders[sizeUpper] ??
          44.0;

      final diff = (garmentShoulders - userShouldersCm).abs();
      if (diff < minDiff) {
        minDiff = diff;
        bestSize = size;
      }
    }

    // Calcular nivel de confianza basado en la cercanía de hombros
    if (minDiff <= 1.5) {
      bestConfidence = 96;
    } else if (minDiff <= 3.0) {
      bestConfidence = 90;
    } else {
      bestConfidence = 82;
    }

    // Armar escalas relativas para visualización en vivo
    final scales = <String, double>{};
    for (final s in availableSizes) {
      final sUpper = s.toUpperCase();
      scales[s] = _defaultScales[sUpper] ?? 1.0;
    }

    return FittingRecommendation(
      recommendedSize: bestSize,
      confidence: bestConfidence,
      verdict: 'Ajuste exacto para tus proporciones (~${userShouldersCm.toStringAsFixed(1)} cm de hombros)',
      estimatedShouldersCm: userShouldersCm,
      sizeScales: scales,
    );
  }
}
