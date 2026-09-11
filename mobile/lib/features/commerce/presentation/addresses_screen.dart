import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressesAsync = ref.watch(addressesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Direcciones'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
        actions: [
          IconButton(
            tooltip: 'Nueva dirección',
            icon: const Icon(Icons.add_location_alt_outlined),
            onPressed: () => _showAddDialog(context, ref),
          ),
        ],
      ),
      body: addressesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => MessageState(
          title: 'No pudimos cargar tus direcciones',
          message: err.toString().replaceAll('ApiException: ', ''),
          onRetry: () => ref.read(addressesProvider.notifier).refresh(),
        ),
        data: (addresses) {
          if (addresses.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.muted,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.location_off_outlined,
                        size: 48,
                        color: AppColors.inkSoft,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'No tienes direcciones guardadas',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Guarda tu casa u oficina para cotizar tus envíos delivery en segundos.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: AppColors.inkSoft),
                    ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: () => _showAddDialog(context, ref),
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Agregar dirección'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.cobalt,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(addressesProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: addresses.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (ctx, idx) => _buildAddressCard(ctx, addresses[idx]),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddDialog(context, ref),
        backgroundColor: AppColors.cobalt,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nueva dirección'),
      ),
    );
  }

  Widget _buildAddressCard(BuildContext context, Address address) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: address.esPrincipal ? AppColors.cobalt : AppColors.line,
          width: address.esPrincipal ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                address.alias ?? 'Dirección',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  color: AppColors.ink,
                ),
              ),
              if (address.esPrincipal)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.cobaltLight,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Predeterminada',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.cobaltDark,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            address.direccion,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 13.5,
              color: AppColors.ink,
            ),
          ),
          if (address.zona != null && address.zona!.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              'Zona: ${address.zona}',
              style: const TextStyle(fontSize: 12.5, color: AppColors.inkSoft),
            ),
          ],
          if (address.referencia != null && address.referencia!.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              'Ref: ${address.referencia}',
              style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _showAddDialog(BuildContext context, WidgetRef ref) async {
    final streetController = TextEditingController();
    final zoneController = TextEditingController();
    final refController = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Agregar nueva dirección'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: streetController,
                decoration: const InputDecoration(
                  labelText: 'Calle y número *',
                  hintText: 'Ej. Av. Ballivián #450',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: zoneController,
                decoration: const InputDecoration(
                  labelText: 'Zona / Barrio *',
                  hintText: 'Ej. San Miguel',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: refController,
                decoration: const InputDecoration(
                  labelText: 'Referencia',
                  hintText: 'Ej. Edificio Los Pinos, Piso 3',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              if (streetController.text.trim().isEmpty ||
                  zoneController.text.trim().isEmpty) {
                return;
              }
              HapticFeedback.selectionClick();
              try {
                await ref.read(addressesProvider.notifier).addAddress(
                      cityId: 1,
                      zone: zoneController.text.trim(),
                      address: streetController.text.trim(),
                      reference: refController.text.trim(),
                      isMain: true,
                    );
                if (ctx.mounted) {
                  Navigator.of(ctx).pop();
                }
              } catch (_) {}
            },
            style: FilledButton.styleFrom(backgroundColor: AppColors.cobalt),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }
}
