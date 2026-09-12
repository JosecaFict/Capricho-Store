import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_dialogs.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_image.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartAsync = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Carrito'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(cartProvider.notifier).refresh(),
          ),
        ],
      ),
      body: cartAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => MessageState(
          title: 'No pudimos cargar tu carrito',
          message: err.toString().replaceAll('ApiException: ', ''),
          onRetry: () => ref.read(cartProvider.notifier).refresh(),
        ),
        data: (cart) {
          if (cart == null || cart.isEmpty) {
            return _buildEmptyCart(context);
          }
          return _buildCartContent(context, ref, cart);
        },
      ),
    );
  }

  Widget _buildEmptyCart(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.cobaltLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.shopping_bag_outlined,
                size: 56,
                color: AppColors.cobalt,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Tu carrito está vacío',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Explora nuestro catálogo de poleras, camisas, blusas y polos y elige tu talla ideal.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.inkSoft, height: 1.4),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => context.go('/catalogo'),
              icon: const Icon(Icons.checkroom_rounded),
              label: const Text('Explorar catálogo'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.cobalt,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartContent(BuildContext context, WidgetRef ref, Cart cart) {
    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: () => ref.read(cartProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 140),
            children: [
              // Badge de Sucursal Única (Regla comercial)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cobalt.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.store_mall_directory_rounded,
                        color: AppColors.cobalt, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Sucursal: ${cart.sucursal ?? "Asignada"}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13.5,
                              color: AppColors.ink,
                            ),
                          ),
                          const Text(
                            'Regla: 1 Carrito = 1 Sucursal física',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppColors.cobalt,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => _confirmClearCart(context, ref),
                      child: const Text(
                        'Vaciar',
                        style: TextStyle(
                          color: AppColors.danger,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Lista de productos
              ...cart.items.map((item) => _buildCartItemCard(context, ref, item)),
            ],
          ),
        ),

        // Barra inferior fija con total y botón de Checkout
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: _buildCheckoutBar(context, cart),
        ),
      ],
    );
  }

  Widget _buildCartItemCard(
    BuildContext context,
    WidgetRef ref,
    CommerceLineItem item,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Imagen miniatura
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 80,
              height: 80,
              child: AdaptiveImage(
                imageUrl: item.imagenUrl,
                aspectRatio: 1,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Información del producto
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.producto,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          color: AppColors.ink,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      icon: const Icon(Icons.close_rounded,
                          size: 18, color: AppColors.inkSoft),
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        ref.read(cartProvider.notifier).removeItem(item.idDetalle);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Color: ${item.color}  ·  Talla: ${item.talla}',
                  style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
                ),
                const SizedBox(height: 4),
                Text(
                  'SKU: ${item.sku}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.inkSoft,
                    fontFamily: 'monospace',
                  ),
                ),
                const SizedBox(height: 10),

                // Controles de cantidad y precio
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Stepper de Cantidad
                    Container(
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.canvas,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 36),
                            icon: const Icon(Icons.remove, size: 16),
                            onPressed: () {
                              HapticFeedback.selectionClick();
                              ref.read(cartProvider.notifier).updateQuantity(
                                    itemId: item.idDetalle,
                                    quantity: item.cantidad - 1,
                                  );
                            },
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Text(
                              '${item.cantidad}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                color: AppColors.ink,
                              ),
                            ),
                          ),
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 36),
                            icon: const Icon(Icons.add, size: 16),
                            onPressed: () {
                              HapticFeedback.selectionClick();
                              ref.read(cartProvider.notifier).updateQuantity(
                                    itemId: item.idDetalle,
                                    quantity: item.cantidad + 1,
                                  );
                            },
                          ),
                        ],
                      ),
                    ),

                    // Subtotal
                    Text(
                      item.formattedSubtotal,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                        color: AppColors.cobaltDark,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckoutBar(BuildContext context, Cart cart) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(top: BorderSide(color: AppColors.line, width: 1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Total productos',
                    style: TextStyle(fontSize: 12, color: AppColors.inkSoft),
                  ),
                  Text(
                    cart.formattedTotal,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: AppColors.ink,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    context.push('/checkout');
                  },
                  icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                  label: const Text('Continuar compra'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.cobalt,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmClearCart(BuildContext context, WidgetRef ref) async {
    final confirm = await AdaptiveDialogs.showConfirmation(
      context: context,
      title: 'Vaciar carrito',
      message: '¿Estás seguro de que deseas eliminar todas las prendas del carrito?',
      confirmText: 'Sí, vaciar',
      cancelText: 'Cancelar',
      isDestructive: true,
    );

    if (confirm == true) {
      HapticFeedback.mediumImpact();
      await ref.read(cartProvider.notifier).clear();
    }
  }
}
