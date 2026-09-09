import { availableAdminModules, visibleAdminNavigation } from './admin-navigation';

describe('admin navigation permissions', () => {
  it('keeps master data hidden for a read-only cashier', () => {
    const labels = availableAdminModules([
      'productos.ver',
      'ventas.ver',
      'ventas.crear',
      'pagos.registrar',
    ]).map((item) => item.label);

    expect(labels).toEqual(['Productos']);
  });

  it('limits an inventory assistant to receiving and inventory modules', () => {
    const labels = availableAdminModules([
      'inventario.ver',
      'inventario.movimiento',
      'recepcion.registrar',
    ]).map((item) => item.label);

    expect(labels).toEqual([
      'Recepciones',
      'Existencias',
      'Lotes',
      'Movimientos',
      'Transferencias',
    ]);
  });

  it('marks only route roots that must use exact active matching', () => {
    const items = visibleAdminNavigation(['inventario.ver']).flatMap((group) => group.items);

    expect(items.find((item) => item.label === 'Dashboard')?.exact).toBe(true);
    expect(items.find((item) => item.label === 'Existencias')?.exact).toBe(true);
    expect(items.find((item) => item.label === 'Lotes')?.exact).toBeUndefined();
  });
});
