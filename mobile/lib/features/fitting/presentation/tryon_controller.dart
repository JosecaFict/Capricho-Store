import 'dart:async';
import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/fitting/data/tryon_repository.dart';
import 'package:capricho_store/features/fitting/domain/tryon_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TryOnState {
  final TryOnQuota? quota;
  final bool isLoadingQuota;
  final String? sessionPhotoPath;
  final TryOnTask? activeTask;
  final bool isGenerating;
  final String? error;
  final bool showBefore;
  final Map<int, String> cachedResultsByColor;

  const TryOnState({
    this.quota,
    this.isLoadingQuota = false,
    this.sessionPhotoPath,
    this.activeTask,
    this.isGenerating = false,
    this.error,
    this.showBefore = false,
    this.cachedResultsByColor = const {},
  });

  TryOnState copyWith({
    TryOnQuota? quota,
    bool? isLoadingQuota,
    String? sessionPhotoPath,
    TryOnTask? activeTask,
    bool? isGenerating,
    String? error,
    bool? showBefore,
    Map<int, String>? cachedResultsByColor,
    bool clearActiveTask = false,
    bool clearError = false,
    bool clearSessionPhoto = false,
  }) {
    return TryOnState(
      quota: quota ?? this.quota,
      isLoadingQuota: isLoadingQuota ?? this.isLoadingQuota,
      sessionPhotoPath: clearSessionPhoto ? null : (sessionPhotoPath ?? this.sessionPhotoPath),
      activeTask: clearActiveTask ? null : (activeTask ?? this.activeTask),
      isGenerating: isGenerating ?? this.isGenerating,
      error: clearError ? null : (error ?? this.error),
      showBefore: showBefore ?? this.showBefore,
      cachedResultsByColor: cachedResultsByColor ?? this.cachedResultsByColor,
    );
  }
}

final tryOnControllerProvider =
    NotifierProvider<TryOnController, TryOnState>(TryOnController.new);

class TryOnController extends Notifier<TryOnState> {
  Timer? _pollingTimer;

  TryOnRepository get _repository => ref.read(tryOnRepositoryProvider);

  @override
  TryOnState build() {
    ref.onDispose(() {
      _pollingTimer?.cancel();
    });
    return const TryOnState();
  }

  Future<void> fetchQuota() async {
    state = state.copyWith(isLoadingQuota: true, clearError: true);
    try {
      final quota = await _repository.getQuota();
      state = state.copyWith(quota: quota, isLoadingQuota: false);
    } catch (e) {
      state = state.copyWith(
        isLoadingQuota: false,
        error: e is ApiException ? e.message : 'No se pudo obtener la cuota de pruebas.',
      );
    }
  }

  void setSessionPhoto(String path) {
    state = state.copyWith(sessionPhotoPath: path, clearError: true);
  }

  void clearSessionPhoto() {
    state = state.copyWith(clearSessionPhoto: true);
  }

  void toggleBeforeAfter() {
    state = state.copyWith(showBefore: !state.showBefore);
  }

  void clearTask() {
    _pollingTimer?.cancel();
    state = state.copyWith(
      clearActiveTask: true,
      isGenerating: false,
      clearError: true,
      showBefore: false,
    );
  }

  void cancelGeneration() {
    _pollingTimer?.cancel();
    state = state.copyWith(
      isGenerating: false,
      clearActiveTask: true,
      clearError: true,
    );
  }

  Future<void> startTryOn({
    required int productId,
    required String imagePath,
    int? colorId,
    String? colorName,
  }) async {
    _pollingTimer?.cancel();

    // Si ya existe resultado en caché para este color, mostrarlo inmediatamente
    if (colorId != null && state.cachedResultsByColor.containsKey(colorId)) {
      final cachedUrl = state.cachedResultsByColor[colorId]!;
      state = state.copyWith(
        activeTask: TryOnTask(
          taskId: 'cached-$colorId',
          status: 'completed',
          progress: 100,
          etaSeconds: 0,
          stepMessage: 'Look cargado desde caché.',
          resultImageUrl: cachedUrl,
          productId: productId,
          colorId: colorId,
          colorName: colorName,
          isLive: true,
        ),
        isGenerating: false,
        showBefore: false,
        clearError: true,
      );
      return;
    }

    state = state.copyWith(
      isGenerating: true,
      clearError: true,
      showBefore: false,
      activeTask: TryOnTask(
        taskId: 'temp-init',
        status: 'pending',
        progress: 10,
        etaSeconds: 15,
        stepMessage: 'Iniciando escáner y conectando con GPU...',
        productId: productId,
        colorId: colorId,
        colorName: colorName,
      ),
    );

    try {
      final createRes = await _repository.createTask(
        productId: productId,
        imagePath: imagePath,
        colorId: colorId,
        colorName: colorName,
      );

      // Actualizar cuota restante si el backend la retornó
      if (createRes.remainingToday != null && state.quota != null) {
        state = state.copyWith(
          quota: TryOnQuota(
            dailyLimit: state.quota!.dailyLimit,
            usedToday: state.quota!.dailyLimit - createRes.remainingToday!,
            remainingToday: createRes.remainingToday!,
          ),
        );
      }

      state = state.copyWith(
        activeTask: TryOnTask(
          taskId: createRes.taskId,
          status: 'processing',
          progress: 20,
          etaSeconds: 15,
          stepMessage: 'Analizando silueta y prenda...',
          productId: productId,
          colorId: colorId,
          colorName: colorName,
        ),
      );

      // Iniciar sondeo cada 2 segundos
      _startPolling(createRes.taskId, colorId);
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Error al iniciar la prueba con IA.';
      state = state.copyWith(
        isGenerating: false,
        error: msg,
        clearActiveTask: true,
      );
    }
  }

  void _startPolling(String taskId, int? colorId) {
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (timer) async {
      try {
        final task = await _repository.getTaskStatus(taskId);

        if (task.isCompleted) {
          timer.cancel();
          final updatedCache = Map<int, String>.from(state.cachedResultsByColor);
          if (colorId != null && task.resultImageUrl != null) {
            updatedCache[colorId] = task.resultImageUrl!;
          }

          state = state.copyWith(
            activeTask: task,
            isGenerating: false,
            cachedResultsByColor: updatedCache,
            showBefore: false,
            clearError: true,
          );
        } else if (task.isFailed) {
          timer.cancel();
          state = state.copyWith(
            activeTask: task,
            isGenerating: false,
            error: task.error ?? 'Ocurrió un error al procesar tu look con IA.',
          );
        } else {
          // Progreso intermedio
          state = state.copyWith(
            activeTask: task,
            isGenerating: true,
          );
        }
      } catch (e) {
        // En caso de fallo transitorio de red, el timer reintentará en el siguiente tick
      }
    });
  }
}
