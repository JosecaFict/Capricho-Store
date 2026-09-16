import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';
import { Sale } from '../models/commerce.model';

describe('ExportService', () => {
  let service: ExportService;

  const mockSale: Sale = {
    id_venta: 101,
    id_cliente: 1,
    id_sucursal: 2,
    sucursal: 'Sucursal Central',
    cliente_nombre: 'Maria Gomez',
    cliente_ci_nit: '1234567',
    cliente_correo: 'maria@example.com',
    cliente_telefono: '77788990',
    id_empleado: 5,
    empleado_nombre: 'Juan Perez',
    id_reserva: null,
    canal_venta: 'PRESENCIAL',
    modalidad_entrega: 'ENTREGA_DIRECTA',
    metodo_pago: 'Efectivo',
    estado: 'PAGADA',
    subtotal: '250.00',
    costo_envio: '0.00',
    total: '250.00',
    fecha_venta: '2026-09-16T10:30:00Z',
    items: [
      {
        id_detalle: 1,
        id_variante: 10,
        sku: 'VF-ROJ-M',
        producto: 'Vestido Floral',
        color: 'Rojo',
        talla: 'M',
        cantidad: 1,
        precio_unitario: '250.00',
        subtotal: '250.00',
        stock_disponible: 10,
        activo: true,
        imagen_url: null,
      },
    ],
  };

  const mockKpis = {
    totalAmount: 250,
    totalCount: 1,
    posAmount: 250,
    posCount: 1,
    webAmount: 0,
    webCount: 0,
    avgTicket: 250,
  };

  const mockSalesFilter = {
    period: 'Hoy',
    branch: 'Todas las sucursales',
    channel: 'Todos los canales',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExportService],
    });
    service = TestBed.inject(ExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should export sales to excel and trigger blob download', async () => {
    const downloadSpy = vi.spyOn<any, any>(service, 'downloadBlob').mockImplementation(() => {});
    await service.exportSalesToExcel([mockSale], mockKpis, mockSalesFilter);
    expect(downloadSpy).toHaveBeenCalled();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect(blob).toBeTruthy();
    expect(filename).toContain('historial_ventas');
    expect(filename).toContain('.xlsx');
  });

  it('should export sales to printable window/pdf', () => {
    const mockPrintWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);

    service.exportSalesToPdf([mockSale], mockKpis, mockSalesFilter);

    expect(window.open).toHaveBeenCalledWith('', '_blank', 'width=1100,height=850');
    expect(mockPrintWindow.document.write).toHaveBeenCalled();
    const writtenHtml = mockPrintWindow.document.write.mock.calls[0][0];
    expect(writtenHtml).toContain('Reporte de Ventas - Capricho Store');
    expect(writtenHtml).toContain('Maria Gomez');
  });

  it('should export supplier purchases to excel and trigger blob download', async () => {
    const downloadSpy = vi.spyOn<any, any>(service, 'downloadBlob').mockImplementation(() => {});
    const mockPurchases = [
      {
        id_recepcion: 44,
        id_orden_compra: 12,
        proveedor: 'Textiles Andinos',
        producto: 'Pantalón Lino',
        color: 'Beige',
        talla: 'S',
        cantidad: 10,
        precio_unitario: 80,
        subtotal: 800,
        total_compra: 800,
        sucursal: 'Central',
        usuario_responsable: 'Admin Capricho',
        fecha_recepcion: '2026-09-16T09:00:00Z',
      },
    ];
    const mockPurchasesFilter = {
      period: 'Hoy',
      supplier: 'Textiles Andinos',
      branch: 'Todas las sucursales',
    };

    await service.exportPurchasesToExcel(mockPurchases, mockPurchasesFilter);
    expect(downloadSpy).toHaveBeenCalled();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect(blob).toBeTruthy();
    expect(filename).toContain('historial_compras');
    expect(filename).toContain('.xlsx');
  });

  it('should export supplier purchases to printable window/pdf', () => {
    const mockPrintWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);

    const mockPurchases = [
      {
        id_recepcion: 44,
        id_orden_compra: 12,
        proveedor: 'Textiles Andinos',
        producto: 'Pantalón Lino',
        color: 'Beige',
        talla: 'S',
        cantidad: 10,
        precio_unitario: 80,
        subtotal: 800,
        total_compra: 800,
        sucursal: 'Central',
        usuario_responsable: 'Admin Capricho',
        fecha_recepcion: '2026-09-16T09:00:00Z',
      },
    ];
    const mockPurchasesFilter = {
      period: 'Hoy',
      supplier: 'Textiles Andinos',
      branch: 'Todas las sucursales',
    };

    service.exportPurchasesToPdf(mockPurchases, mockPurchasesFilter);
    expect(window.open).toHaveBeenCalledWith('', '_blank', 'width=1100,height=850');
    expect(mockPrintWindow.document.write).toHaveBeenCalled();
    const writtenHtml = mockPrintWindow.document.write.mock.calls[0][0];
    expect(writtenHtml).toContain('Reporte de Compras - Capricho Store');
    expect(writtenHtml).toContain('Textiles Andinos');
    expect(writtenHtml).toContain('Pantalón Lino');
  });
});
