import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/location_map_preview.dart';
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
    final hasGps = address.latitud != null && address.longitud != null;
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
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: hasGps ? const Color(0xFFEFF6FF) : AppColors.muted,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: hasGps ? const Color(0xFFBFDBFE) : AppColors.line,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.location_on_rounded,
                  size: 13,
                  color: hasGps ? AppColors.cobalt : AppColors.inkSoft,
                ),
                const SizedBox(width: 4),
                Text(
                  hasGps
                      ? 'GPS: ${address.latitud!.toStringAsFixed(4)}, ${address.longitud!.toStringAsFixed(4)} (Cotizable)'
                      : 'GPS: SCZ Centro (Automático)',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: hasGps ? AppColors.cobaltDark : AppColors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showAddDialog(BuildContext context, WidgetRef ref) async {
    final aliasController = TextEditingController();
    final streetController = TextEditingController();
    final zoneController = TextEditingController(text: 'Centro');
    final refController = TextEditingController();
    final latController = TextEditingController(text: '-17.7833');
    final lngController = TextEditingController(text: '-63.1821');
    bool isMain = true;
    String? selectedZone = 'Centro';

    const sczZones = [
      {'name': 'Centro', 'lat': -17.7833, 'lng': -63.1821},
      {'name': 'Equipetrol', 'lat': -17.7680, 'lng': -63.1950},
      {'name': 'Urbarí', 'lat': -17.7950, 'lng': -63.1980},
      {'name': 'Las Palmas', 'lat': -17.8050, 'lng': -63.2080},
      {'name': 'Norte / Banzer', 'lat': -17.7400, 'lng': -63.1800},
      {'name': 'Plan 3000', 'lat': -17.8250, 'lng': -63.1350},
    ];

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.add_location_alt_rounded, color: AppColors.cobalt),
              SizedBox(width: 8),
              Text('Nueva dirección', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ],
          ),
          content: SizedBox(
            width: MediaQuery.of(context).size.width,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                TextField(
                  controller: aliasController,
                  decoration: const InputDecoration(
                    labelText: 'Nombre / Alias (opcional)',
                    hintText: 'Ej. Casa, Oficina, Depto',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: streetController,
                  decoration: const InputDecoration(
                    labelText: 'Calle y número *',
                    hintText: 'Ej. Av. San Martín #450',
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Zonas rápidas de Santa Cruz (asigna GPS):',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.inkSoft),
                ),
                const SizedBox(height: 6),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: sczZones.map((z) {
                      final isSelected = selectedZone == z['name'];
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(z['name'] as String, style: const TextStyle(fontSize: 12)),
                          selected: isSelected,
                          selectedColor: AppColors.cobaltLight,
                          onSelected: (val) {
                            if (val) {
                              setModalState(() {
                                selectedZone = z['name'] as String;
                                zoneController.text = z['name'] as String;
                                latController.text = (z['lat'] as double).toStringAsFixed(4);
                                lngController.text = (z['lng'] as double).toStringAsFixed(4);
                              });
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: zoneController,
                  decoration: const InputDecoration(
                    labelText: 'Zona / Barrio *',
                    hintText: 'Ej. Equipetrol',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: refController,
                  decoration: const InputDecoration(
                    labelText: 'Referencia',
                    hintText: 'Ej. Portón blanco, frente al parque',
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Mapa de ubicación (arrastra para ajustar el pin):',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.inkSoft),
                ),
                const SizedBox(height: 8),
                LocationMapPreview(
                  latitude: double.tryParse(latController.text.trim()) ?? -17.7833,
                  longitude: double.tryParse(lngController.text.trim()) ?? -63.1821,
                  zone: selectedZone ?? zoneController.text,
                  onLocationChanged: (coords) {
                    setModalState(() {
                      latController.text = coords.lat.toStringAsFixed(4);
                      lngController.text = coords.lng.toStringAsFixed(4);
                    });
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: latController,
                        keyboardType: const TextInputType.numberWithOptions(signed: true, decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Latitud GPS *',
                          prefixIcon: Icon(Icons.my_location_rounded, size: 16),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: lngController,
                        keyboardType: const TextInputType.numberWithOptions(signed: true, decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Longitud GPS *',
                          prefixIcon: Icon(Icons.location_searching_rounded, size: 16),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Checkbox(
                      value: isMain,
                      onChanged: (val) => setModalState(() => isMain = val ?? true),
                      activeColor: AppColors.cobalt,
                    ),
                    const Expanded(
                      child: Text(
                        'Marcar como dirección predeterminada',
                        style: TextStyle(fontSize: 13, color: AppColors.ink),
                      ),
                    ),
                  ],
                ),
              ],
            ),
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
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Por favor completa la calle y la zona')),
                  );
                  return;
                }
                HapticFeedback.selectionClick();
                final lat = double.tryParse(latController.text.trim()) ?? -17.7833;
                final lng = double.tryParse(lngController.text.trim()) ?? -63.1821;
                try {
                  await ref.read(addressesProvider.notifier).addAddress(
                        cityId: 1,
                        alias: aliasController.text.trim().isNotEmpty
                            ? aliasController.text.trim()
                            : null,
                        zone: zoneController.text.trim(),
                        address: streetController.text.trim(),
                        reference: refController.text.trim().isNotEmpty
                            ? refController.text.trim()
                            : null,
                        latitude: lat,
                        longitude: lng,
                        isMain: isMain,
                      );
                  if (ctx.mounted) {
                    Navigator.of(ctx).pop();
                  }
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error al guardar: $e')),
                    );
                  }
                }
              },
              style: FilledButton.styleFrom(backgroundColor: AppColors.cobalt),
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }
}
