class TryOnQuota {
  final int dailyLimit;
  final int usedToday;
  final int remainingToday;

  const TryOnQuota({
    required this.dailyLimit,
    required this.usedToday,
    required this.remainingToday,
  });

  factory TryOnQuota.fromJson(Map<String, dynamic> json) {
    return TryOnQuota(
      dailyLimit: (json['daily_limit'] as num?)?.toInt() ?? 5,
      usedToday: (json['used_today'] as num?)?.toInt() ?? 0,
      remainingToday: (json['remaining_today'] as num?)?.toInt() ?? 5,
    );
  }
}

class TryOnTaskCreateResponse {
  final String taskId;
  final String status;
  final String message;
  final int? remainingToday;

  const TryOnTaskCreateResponse({
    required this.taskId,
    required this.status,
    required this.message,
    this.remainingToday,
  });

  factory TryOnTaskCreateResponse.fromJson(Map<String, dynamic> json) {
    return TryOnTaskCreateResponse(
      taskId: json['task_id'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      message: json['message'] as String? ?? '',
      remainingToday: (json['remaining_today'] as num?)?.toInt(),
    );
  }
}

class TryOnTask {
  final String taskId;
  final String status; // 'pending', 'processing', 'completed', 'failed'
  final int progress;
  final int etaSeconds;
  final String stepMessage;
  final String? resultImageUrl;
  final String? originalPhotoUrl;
  final String? garmentImageUrl;
  final int productId;
  final int? colorId;
  final String? colorName;
  final String? error;
  final bool isLive;

  const TryOnTask({
    required this.taskId,
    required this.status,
    required this.progress,
    required this.etaSeconds,
    required this.stepMessage,
    this.resultImageUrl,
    this.originalPhotoUrl,
    this.garmentImageUrl,
    required this.productId,
    this.colorId,
    this.colorName,
    this.error,
    this.isLive = false,
  });

  factory TryOnTask.fromJson(Map<String, dynamic> json) {
    return TryOnTask(
      taskId: json['task_id'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      progress: (json['progress'] as num?)?.toInt() ?? 0,
      etaSeconds: (json['eta_seconds'] as num?)?.toInt() ?? 15,
      stepMessage: json['step_message'] as String? ?? 'Iniciando escáner...',
      resultImageUrl: json['result_image_url'] as String?,
      originalPhotoUrl: json['original_photo_url'] as String?,
      garmentImageUrl: json['garment_image_url'] as String?,
      productId: (json['product_id'] as num?)?.toInt() ?? 0,
      colorId: (json['color_id'] as num?)?.toInt(),
      colorName: json['color_name'] as String?,
      error: json['error'] as String?,
      isLive: json['is_live'] as bool? ?? false,
    );
  }

  bool get isCompleted => status == 'completed';
  bool get isFailed => status == 'failed';
  bool get isProcessing => status == 'pending' || status == 'processing';
}
