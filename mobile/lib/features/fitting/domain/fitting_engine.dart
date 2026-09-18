import 'package:capricho_store/features/catalog/domain/catalog_models.dart';

class FittingRecommendation {
  const FittingRecommendation({
    required this.recommendedSize,
    required this.confidence,
    required this.verdict,
    this.estimatedShouldersCm = 44.0,
    this.sizeScales = const {},
    this.isBorderline = false,
    this.alternativeSize,
    this.gender = 'HOMBRE',
  });

  final String recommendedSize;
  final int confidence; // 0 - 100
  final String verdict;
  final double estimatedShouldersCm;
  final Map<String, double> sizeScales;
  final bool isBorderline;
  final String? alternativeSize;
  final String gender;
}

class FittingEngine {
  /// Hombros estándar de referencia para Hombres (cm)
  static const Map<String, double> _standardShouldersMen = {
    'XS': 38.0,
    'S': 41.0,
    'M': 44.0,
    'L': 47.0,
    'XL': 50.0,
    'XXL': 53.0,
    '3XL': 56.0,
  };

  /// Hombros estándar de referencia para Mujeres (cm)
  static const Map<String, double> _standardShouldersWomen = {
    'XS': 33.0,
    'S': 35.5,
    'M': 38.0,
    'L': 40.5,
    'XL': 43.0,
    'XXL': 46.0,
    '3XL': 49.0,
  };

  /// Factores de escala visual relativa para cada talla en el vestidor
  static const Map<String, double> _defaultScales = {
    'XS': 0.88,
    'S': 0.94,
    'M': 1.00,
    'L': 1.08,
    'XL': 1.16,
    'XXL': 1.24,
    '3XL': 1.32,
  };

  /// Calcula la talla óptima de la prenda comparando las medidas de hombros,
  /// diferenciando silueta masculina y femenina y detectando tallas fronterizas.
  static FittingRecommendation evaluate({
    required List<ProductMeasurement> measurements,
    required List<String> availableSizes,
    double userShouldersCm = 44.0,
    String gender = 'HOMBRE',
  }) {
    final isFemale = gender.toUpperCase() == 'MUJER';
    final fallbackShoulders =
        isFemale ? _standardShouldersWomen : _standardShouldersMen;

    if (availableSizes.isEmpty) {
      return FittingRecommendation(
        recommendedSize: 'M',
        confidence: 85,
        verdict: 'Talla estándar recomendada',
        gender: isFemale ? 'MUJER' : 'HOMBRE',
      );
    }

    // Mapa de medidas de la prenda indexado por talla
    final measurementMap = <String, ProductMeasurement>{};
    for (final m in measurements) {
      measurementMap[m.size.toUpperCase()] = m;
    }

    // Calcular la diferencia absoluta para cada talla disponible
    final evaluatedList = <MapEntry<String, double>>[];
    for (final size in availableSizes) {
      final sizeUpper = size.toUpperCase();
      final garmentShoulders = measurementMap[sizeUpper]?.shouldersCm ??
          fallbackShoulders[sizeUpper] ??
          (isFemale ? 38.0 : 44.0);

      final diff = (garmentShoulders - userShouldersCm).abs();
      evaluatedList.add(MapEntry(size, diff));
    }

    // Ordenar de menor a mayor diferencia (la más cercana primero)
    evaluatedList.sort((a, b) => a.value.compareTo(b.value));

    final bestSize = evaluatedList.first.key;
    final bestDiff = evaluatedList.first.value;

    // Detectar si está en la frontera entre dos tallas (ej. M y L a <= 1.2 cm)
    bool isBorderline = false;
    String? alternativeSize;
    if (evaluatedList.length > 1) {
      final secondBest = evaluatedList[1];
      if ((secondBest.value - bestDiff) <= 1.2) {
        isBorderline = true;
        alternativeSize = secondBest.key;
      }
    }

    // Calcular nivel de confianza basado en la cercanía de hombros
    int confidence;
    if (bestDiff <= 1.5) {
      confidence = 96;
    } else if (bestDiff <= 3.0) {
      confidence = 90;
    } else {
      confidence = 82;
    }

    // Armar escalas relativas para visualización en vivo
    final scales = <String, double>{};
    for (final s in availableSizes) {
      final sUpper = s.toUpperCase();
      scales[s] = _defaultScales[sUpper] ?? 1.0;
    }

    final verdict = isBorderline && alternativeSize != null
        ? 'Talla $bestSize sugerida (~${userShouldersCm.toStringAsFixed(1)} cm). Talla intermedia con $alternativeSize; pruébalas en el espejo.'
        : 'Ajuste exacto para tus proporciones (~${userShouldersCm.toStringAsFixed(1)} cm de hombros)';

    return FittingRecommendation(
      recommendedSize: bestSize,
      confidence: confidence,
      verdict: verdict,
      estimatedShouldersCm: userShouldersCm,
      sizeScales: scales,
      isBorderline: isBorderline,
      alternativeSize: alternativeSize,
      gender: isFemale ? 'MUJER' : 'HOMBRE',
    );
  }
}
