import 'package:capricho_store/features/catalog/domain/catalog_models.dart';

class FittingRecommendation {
  const FittingRecommendation({
    required this.recommendedSize,
    required this.confidence,
    required this.verdict,
    this.alternativeSize,
    this.alternativeNote,
    this.estimatedShouldersCm = 44.0,
    this.sizeScales = const {},
  });

  final String recommendedSize;
  final int confidence; // 0 - 100
  final String verdict;
  final String? alternativeSize;
  final String? alternativeNote;
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
  };

  /// Factores de escala visual relativa para cada talla
  static const Map<String, double> _defaultScales = {
    'XS': 0.88,
    'S': 0.94,
    'M': 1.00,
    'L': 1.07,
    'XL': 1.15,
    'XXL': 1.22,
  };

  /// Calcula la recomendación óptima comparando las medidas anatómicas con la tabla de la prenda.
  static FittingRecommendation evaluate({
    required List<ProductMeasurement> measurements,
    required List<String> availableSizes,
    double userShouldersCm = 44.0,
    double? userChestCm,
    String preferredFit = 'REGULAR', // SLIM, REGULAR, OVERSIZE
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

      double targetShoulders = userShouldersCm;
      if (preferredFit == 'SLIM') {
        targetShoulders += 1.5; // Prendas más ceñidas
      } else if (preferredFit == 'OVERSIZE') {
        targetShoulders -= 3.0; // Prendas con más holgura
      }

      final diff = (garmentShoulders - targetShoulders).abs();
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

    // Evaluar alternativa oversize (siempre la siguiente talla MAYOR en la escala)
    String? altSize;
    String? altNote;
    const sizeHierarchy = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
    final bestUpper = bestSize.toUpperCase();
    final hierarchyIndex = sizeHierarchy.indexOf(bestUpper);
    if (hierarchyIndex != -1) {
      for (int i = hierarchyIndex + 1; i < sizeHierarchy.length; i++) {
        final target = sizeHierarchy[i];
        final match = availableSizes.firstWhere(
          (s) => s.toUpperCase() == target,
          orElse: () => '',
        );
        if (match.isNotEmpty) {
          altSize = match;
          altNote = 'Si prefieres un look holgado / oversize, prueba la talla $altSize.';
          break;
        }
      }
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
      verdict: 'Ajuste ideal según tus proporciones (~${userShouldersCm.toStringAsFixed(1)} cm de hombros)',
      alternativeSize: altSize,
      alternativeNote: altNote,
      estimatedShouldersCm: userShouldersCm,
      sizeScales: scales,
    );
  }
}
