import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_dialogs.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

class ReservationBottomSheet extends ConsumerStatefulWidget {
  final Product product;
  final ProductVariant variant;
  final int branchId;
  final String branchName;

  const ReservationBottomSheet({
    super.key,
    required this.product,
    required this.variant,
    required this.branchId,
    required this.branchName,
  });

  static Future<bool?> show(
    BuildContext context, {
    required Product product,
    required ProductVariant variant,
    required int branchId,
    required String branchName,
  }) {
    final isIOS = defaultTargetPlatform == TargetPlatform.iOS;
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ReservationBottomSheet(
        product: product,
        variant: variant,
        branchId: branchId,
        branchName: branchName,
      ),
    );
  }

  @override
  ConsumerState<ReservationBottomSheet> createState() =>
      _ReservationBottomSheetState();
}

class _ReservationBottomSheetState
    extends ConsumerState<ReservationBottomSheet> {
  DateTime? _selectedDateTime;
  final _observationController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Sugerir por defecto mañana a las 10:00 AM
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    _selectedDateTime = DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 10, 0);
  }

  @override
  void dispose() {
    _observationController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    HapticFeedback.selectionClick();
    final now = DateTime.now();
    final initial = _selectedDateTime ?? now.add(const Duration(hours: 3));
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 3)),
      helpText: 'Selecciona la fecha de tu prueba',
      confirmText: 'Elegir hora',
      cancelText: 'Cancelar',
    );

    if (pickedDate != null && mounted) {
      final pickedTime = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(initial),
        helpText: 'Horario comercial (09:00 a 19:00)',
      );

      if (pickedTime != null && mounted) {
        setState(() {
          _selectedDateTime = DateTime(
            pickedDate.year,
            pickedDate.month,
            pickedDate.day,
            pickedTime.hour,
            pickedTime.minute,
          );
          _error = null;
        });
        HapticFeedback.lightImpact();
      }
    }
  }

  Future<void> _confirmReservation() async {
    if (_selectedDateTime == null) {
      setState(() => _error = 'Por favor selecciona la fecha y hora de prueba.');
      return;
    }

    final now = DateTime.now();
    if (_selectedDateTime!.isBefore(now.add(const Duration(hours: 1)))) {
      setState(() => _error = 'La cita debe agendarse con al menos 1 hora de anticipación.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      HapticFeedback.mediumImpact();
      await ref.read(reservationsProvider.notifier).createReservation(
            branchId: widget.branchId,
            appointmentDate: _selectedDateTime,
            observation: _observationController.text.trim().isNotEmpty
                ? _observationController.text.trim()
                : null,
            variantId: widget.variant.id,
            quantity: 1,
          );

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '¡Prenda reservada en ${widget.branchName}! Revisa tu pestaña de reservas.',
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('ApiException: ', '');
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final formattedDate = _selectedDateTime != null
        ? DateFormat('EEEE d \'de\' MMMM, HH:mm', 'es').format(_selectedDateTime!)
        : 'Seleccionar fecha y hora';

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, 24 + bottomInset),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Barra de arrastre superior
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Título
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.cobaltLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.checkroom_rounded,
                        color: AppColors.cobalt, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Reservar prenda para prueba',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: AppColors.ink,
                          ),
                        ),
                        Text(
                          'Apartamos tu prenda por hasta 48 horas',
                          style: TextStyle(fontSize: 12, color: AppColors.inkSoft),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Resumen de prenda
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.canvas,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.product.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Color: ${widget.variant.color}  ·  Talla: ${widget.variant.size}${widget.product.price != null ? "  ·  Bs ${widget.product.price!.toStringAsFixed(2)}" : ""}',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.inkSoft),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.store_mall_directory_outlined,
                            size: 14, color: AppColors.cobalt),
                        const SizedBox(width: 6),
                        Text(
                          'Sucursal: ${widget.branchName}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.cobalt,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Selector de Fecha y Hora
              const Text(
                'Fecha y hora de visita estimada',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 6),
              InkWell(
                onTap: _submitting ? null : _pickDate,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.cobalt, width: 1.2),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today_rounded,
                          size: 18, color: AppColors.cobalt),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          formattedDate,
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded,
                          size: 14, color: AppColors.inkSoft),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Campo de observaciones
              TextField(
                controller: _observationController,
                maxLength: 200,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'Nota u observación (opcional)',
                  hintText: 'Ej. Pasaré en horario de almuerzo',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.line),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.cobalt, width: 1.5),
                  ),
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),

              // Botón de Confirmación
              FilledButton(
                onPressed: _submitting ? null : _confirmReservation,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.cobalt,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Confirmar reserva sin costo',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
