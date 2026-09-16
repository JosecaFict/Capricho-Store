import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { Sale } from '../models/commerce.model';
import { LOGO_CAPRICHO_BASE64, LOGO_CAPRICHO_RAW_BASE64 } from '../constants/logo-base64';

export interface SalesFilterInfo {
  period: string;
  branch: string;
  channel: string;
  search?: string;
}

export interface PurchasesFilterInfo {
  period?: string;
  supplier: string;
  branch: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesKpisInfo {
  totalAmount: number;
  totalCount: number;
  posAmount: number;
  posCount: number;
  webAmount: number;
  webCount: number;
  avgTicket: number;
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  /**
   * Exporta las ventas filtradas a un archivo Excel (.xlsx) con el logotipo oficial incrustado,
   * metadatos de los filtros activos, métricas de resumen y tabla de datos formateada.
   */
  async exportSalesToExcel(
    sales: Sale[],
    kpis: SalesKpisInfo,
    filters: SalesFilterInfo,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Capricho Store';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Historial de Ventas', {
      views: [{ showGridLines: true }],
    });

    // 1. Incrustar Logotipo Oficial en la cabecera (esquina superior izquierda A1:B3)
    try {
      const logoId = workbook.addImage({
        base64: LOGO_CAPRICHO_RAW_BASE64,
        extension: 'png',
      });
      sheet.addImage(logoId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 68, height: 68 },
      });
    } catch {
      // Si falla la imagen, el reporte continúa con el texto
    }

    // 2. Título corporativo y Metadatos
    sheet.getCell('C1').value = 'CAPRICHO STORE - HISTORIAL DE VENTAS';
    sheet.getCell('C1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };

    sheet.getCell('C2').value = `Filtros: [Período: ${filters.period}] · [Sucursal: ${filters.branch}] · [Canal: ${filters.channel}]${filters.search ? ` · [Búsqueda: "${filters.search}"]` : ''}`;
    sheet.getCell('C2').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };

    sheet.getCell('C3').value = `Fecha de emisión: ${new Date().toLocaleString('es-BO')} | Registros exportados: ${sales.length}`;
    sheet.getCell('C3').font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };

    // 3. Fila de KPIs de resumen (Fila 5)
    sheet.getRow(5).values = [
      'Resumen:',
      'Total Facturado:',
      kpis.totalAmount,
      'Ventas POS:',
      kpis.posAmount,
      'Ventas Web:',
      kpis.webAmount,
      'Ticket Promedio:',
      kpis.avgTicket,
      'Total Registros:',
      kpis.totalCount,
    ];
    sheet.getRow(5).font = { name: 'Calibri', size: 9.5, bold: true };
    sheet.getCell('C5').numFmt = '"Bs. "#,##0.00';
    sheet.getCell('E5').numFmt = '"Bs. "#,##0.00';
    sheet.getCell('G5').numFmt = '"Bs. "#,##0.00';
    sheet.getCell('I5').numFmt = '"Bs. "#,##0.00';

    // 4. Encabezados de la tabla (Fila 7)
    const headerRow = sheet.getRow(7);
    headerRow.values = [
      'Nro. Venta',
      'Fecha',
      'Hora',
      'Canal',
      'Modalidad Entrega',
      'Cliente Facturado',
      'Documento (CI/NIT)',
      'Correo',
      'Teléfono',
      'Sucursal',
      'Atendido Por',
      'Prendas',
      'Método de Pago',
      'Total (Bs.)',
      'Estado',
    ];
    headerRow.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    // Estilo azul cobalto corporativo de Capricho Store
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF064FE8' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF064FE8' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      };
    });

    // 5. Filas de datos
    let currentRow = 8;
    for (const sale of sales) {
      const dateObj = sale.fecha_venta ? new Date(sale.fecha_venta) : null;
      const fechaStr = dateObj ? dateObj.toLocaleDateString('es-BO') : 'N/D';
      const horaStr = dateObj ? dateObj.toLocaleTimeString('es-BO') : 'N/D';
      const itemsCount = sale.items?.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0) || 1;

      const row = sheet.getRow(currentRow);
      row.values = [
        sale.id_venta,
        fechaStr,
        horaStr,
        sale.canal_venta === 'PRESENCIAL' ? 'Presencial (POS)' : 'Web (Online)',
        sale.modalidad_entrega === 'DELIVERY' ? 'Envío por delivery' : 'Entrega directa mostrador',
        sale.cliente_nombre || 'Consumidor Final',
        sale.cliente_ci_nit || 'S/N',
        sale.cliente_correo || 'No registrado',
        sale.cliente_telefono || 'No registrado',
        sale.sucursal || 'Capricho Central',
        sale.empleado_nombre || (sale.canal_venta === 'PRESENCIAL' ? 'Cajero de turno' : 'Tienda Online (Stripe)'),
        itemsCount,
        sale.metodo_pago || (sale.canal_venta === 'PRESENCIAL' ? 'Efectivo' : 'Tarjeta (Stripe)'),
        Number(sale.total || 0),
        sale.estado || 'PAGADA',
      ];

      // Formato numérico y alineaciones
      row.font = { name: 'Calibri', size: 9.5 };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(12).alignment = { horizontal: 'center' };
      row.getCell(14).alignment = { horizontal: 'right' };
      row.getCell(14).numFmt = '"Bs. "#,##0.00';
      row.getCell(15).alignment = { horizontal: 'center' };

      // Filas alternas suaves
      if (currentRow % 2 === 0) {
        row.eachCell((cell, colNumber) => {
          if (colNumber <= 15) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        });
      }

      currentRow++;
    }

    // 6. Fila de Totales al final
    const totalRow = sheet.getRow(currentRow);
    totalRow.values = [
      'TOTAL CONSOLIDADO',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      sales.reduce((sum, s) => sum + (s.items?.reduce((is, i) => is + (Number(i.cantidad) || 0), 0) || 1), 0),
      '',
      kpis.totalAmount,
      `${sales.length} ventas`,
    ];
    totalRow.font = { name: 'Calibri', size: 10, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'left' };
    totalRow.getCell(12).alignment = { horizontal: 'center' };
    totalRow.getCell(14).alignment = { horizontal: 'right' };
    totalRow.getCell(14).numFmt = '"Bs. "#,##0.00';
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };
    });

    // 7. Auto-ajustar ancho de columnas
    sheet.columns = [
      { width: 12 }, // Nro. Venta
      { width: 14 }, // Fecha
      { width: 12 }, // Hora
      { width: 17 }, // Canal
      { width: 24 }, // Modalidad Entrega
      { width: 26 }, // Cliente
      { width: 16 }, // CI/NIT
      { width: 26 }, // Correo
      { width: 15 }, // Teléfono
      { width: 24 }, // Sucursal
      { width: 25 }, // Atendido Por
      { width: 10 }, // Prendas
      { width: 22 }, // Método de Pago
      { width: 16 }, // Total
      { width: 14 }, // Estado
    ];

    // 8. Generar buffer y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const cleanPeriod = (filters.period || 'todos').toLowerCase().replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadBlob(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `historial_ventas_${cleanPeriod}_${dateStr}.xlsx`,
    );
  }

  /**
   * Exporta las ventas filtradas a un reporte imprimible/PDF de alta fidelidad con el logo oficial,
   * tarjetas de KPI, formato horizontal y diálogo de impresión o guardado como PDF.
   */
  exportSalesToPdf(
    sales: Sale[],
    kpis: SalesKpisInfo,
    filters: SalesFilterInfo,
  ): void {
    const cleanPeriod = filters.period || 'Todos';
    const dateStr = new Date().toLocaleString('es-BO');

    const rowsHtml = sales
      .map((sale) => {
        const dateObj = sale.fecha_venta ? new Date(sale.fecha_venta) : null;
        const fechaStr = dateObj ? dateObj.toLocaleDateString('es-BO') : 'N/D';
        const horaStr = dateObj ? dateObj.toLocaleTimeString('es-BO') : '';
        const itemsCount = sale.items?.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0) || 1;
        const channelLabel = sale.canal_venta === 'PRESENCIAL' ? 'Presencial (POS)' : 'Web (Online)';
        const customer = sale.cliente_nombre || 'Consumidor Final';
        const doc = sale.cliente_ci_nit ? `CI: ${sale.cliente_ci_nit}` : '';

        return `
          <tr>
            <td style="font-weight: 700; text-align: center;">#${sale.id_venta}</td>
            <td>
              <div>${fechaStr}</div>
              <small style="color: #64748b; font-size: 0.75rem;">${horaStr}</small>
            </td>
            <td>
              <span class="badge ${sale.canal_venta === 'PRESENCIAL' ? 'badge--pos' : 'badge--web'}">${channelLabel}</span>
            </td>
            <td>
              <div style="font-weight: 600;">${customer}</div>
              <small style="color: #64748b; font-size: 0.75rem;">${doc}</small>
            </td>
            <td>
              <div>${sale.sucursal || 'Central'}</div>
              <small style="color: #64748b; font-size: 0.75rem;">${sale.empleado_nombre || (sale.canal_venta === 'PRESENCIAL' ? 'Caja' : 'Stripe')}</small>
            </td>
            <td style="text-align: center;">${itemsCount}</td>
            <td>${sale.metodo_pago || 'Efectivo'}</td>
            <td style="text-align: right; font-weight: 700; color: #064fe8;">Bs. ${Number(sale.total || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Reporte de Ventas - Capricho Store</title>
        <style>
          @page {
            size: letter landscape;
            margin: 10mm 12mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 11px;
            background: #ffffff;
          }
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #064fe8;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .report-brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .report-brand img {
            height: 52px;
            width: auto;
            object-fit: contain;
          }
          .report-brand-text h1 {
            font-size: 16px;
            margin: 0;
            letter-spacing: 0.05em;
            color: #0f172a;
            font-weight: 800;
          }
          .report-brand-text p {
            margin: 2px 0 0;
            font-size: 9.5px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .report-meta {
            text-align: right;
            font-size: 9.5px;
            color: #475569;
          }
          .report-meta strong {
            font-size: 13px;
            color: #064fe8;
            display: block;
            margin-bottom: 2px;
          }
          .report-filters {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 12px;
            margin-bottom: 12px;
            font-size: 10px;
            display: flex;
            gap: 16px;
          }
          .report-filters span {
            color: #475569;
          }
          .report-filters strong {
            color: #0f172a;
          }
          .kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            background: #ffffff;
            border-left: 3px solid #064fe8;
          }
          .kpi-card__label {
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
          }
          .kpi-card__val {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin: 2px 0;
          }
          .kpi-card__sub {
            font-size: 8.5px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
          }
          th {
            background: #0f172a;
            color: #ffffff;
            padding: 6px 8px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            text-align: left;
          }
          td {
            padding: 5px 8px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge--pos {
            background: #e0f2fe;
            color: #0369a1;
          }
          .badge--web {
            background: #f3e8ff;
            color: #7e22ce;
          }
          .total-row td {
            font-weight: 800;
            font-size: 10.5px;
            background: #e2e8f0 !important;
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
          }
          .report-footer {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="report-brand">
            <img src="${LOGO_CAPRICHO_BASE64}" alt="Capricho Store Logo" />
            <div class="report-brand-text">
              <h1>CAPRICHO STORE</h1>
              <p>Control Operativo y Financiero</p>
            </div>
          </div>
          <div class="report-meta">
            <strong>REPORTE DE HISTORIAL DE VENTAS</strong>
            <span>Emisión: ${dateStr}</span>
          </div>
        </div>

        <div class="report-filters">
          <div><span>Filtro de período:</span> <strong>${cleanPeriod}</strong></div>
          <div><span>Sucursal:</span> <strong>${filters.branch}</strong></div>
          <div><span>Canal:</span> <strong>${filters.channel}</strong></div>
          ${filters.search ? `<div><span>Búsqueda:</span> <strong>"${filters.search}"</strong></div>` : ''}
          <div style="margin-left: auto;"><span>Registros:</span> <strong>${sales.length} transacciones</strong></div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-card__label">Total Facturado</div>
            <div class="kpi-card__val">Bs. ${kpis.totalAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-card__sub">${kpis.totalCount} transacciones registradas</div>
          </div>
          <div class="kpi-card" style="border-left-color: #0284c7;">
            <div class="kpi-card__label">Ventas Presenciales (POS)</div>
            <div class="kpi-card__val">Bs. ${kpis.posAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-card__sub">${kpis.posCount} cobros en mostrador</div>
          </div>
          <div class="kpi-card" style="border-left-color: #9333ea;">
            <div class="kpi-card__label">Ventas Online (Web)</div>
            <div class="kpi-card__val">Bs. ${kpis.webAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-card__sub">${kpis.webCount} pedidos Stripe</div>
          </div>
          <div class="kpi-card" style="border-left-color: #10b981;">
            <div class="kpi-card__label">Ticket Promedio</div>
            <div class="kpi-card__val">Bs. ${kpis.avgTicket.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-card__sub">Por venta completada</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;"># Venta</th>
              <th style="width: 90px;">Fecha y Hora</th>
              <th style="width: 90px;">Canal</th>
              <th>Cliente / CI-NIT</th>
              <th>Sucursal & Atendido</th>
              <th style="width: 50px; text-align: center;">Prendas</th>
              <th style="width: 100px;">Método Pago</th>
              <th style="width: 90px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="5">TOTAL CONSOLIDADO (${sales.length} VENTAS)</td>
              <td style="text-align: center;">${sales.reduce((sum, s) => sum + (s.items?.reduce((is, i) => is + (Number(i.cantidad) || 0), 0) || 1), 0)}</td>
              <td></td>
              <td style="text-align: right;">Bs. ${kpis.totalAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="report-footer">
          <span>Capricho Store - Sistema Administrativo Integral</span>
          <span>Impreso el ${dateStr}</span>
        </div>
      </body>
      </html>
    `;

    this.openPrintWindow(htmlContent);
  }

  /**
   * Exporta las compras a proveedores a un archivo Excel (.xlsx) con el logotipo oficial incrustado,
   * metadatos y formato contable.
   */
  async exportPurchasesToExcel(
    items: Array<Record<string, string | number | null>>,
    filters: PurchasesFilterInfo,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Capricho Store';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Historial de Compras', {
      views: [{ showGridLines: true }],
    });

    // 1. Incrustar Logotipo Oficial
    try {
      const logoId = workbook.addImage({
        base64: LOGO_CAPRICHO_RAW_BASE64,
        extension: 'png',
      });
      sheet.addImage(logoId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 68, height: 68 },
      });
    } catch {
      // Ignorar si hay problema con la imagen
    }

    // 2. Título corporativo y Metadatos
    sheet.getCell('C1').value = 'CAPRICHO STORE - HISTORIAL DE COMPRAS A PROVEEDORES';
    sheet.getCell('C1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };

    sheet.getCell('C2').value = `Filtros: [Proveedor: ${filters.supplier}] · [Sucursal: ${filters.branch}]${filters.period ? ` · [Período: ${filters.period}]` : ''}${filters.dateFrom ? ` · [Desde: ${filters.dateFrom}]` : ''}${filters.dateTo ? ` · [Hasta: ${filters.dateTo}]` : ''}`;
    sheet.getCell('C2').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };

    sheet.getCell('C3').value = `Fecha de emisión: ${new Date().toLocaleString('es-BO')} | Total registros: ${items.length}`;
    sheet.getCell('C3').font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };

    // 3. Resumen acumulado (Fila 5)
    const totalInvertido = items.reduce((sum, it) => sum + (Number(it['subtotal']) || 0), 0);
    const totalPrendas = items.reduce((sum, it) => sum + (Number(it['cantidad']) || 0), 0);

    sheet.getRow(5).values = [
      'Resumen:',
      'Total Compras:',
      totalInvertido,
      'Total Prendas Recibidas:',
      totalPrendas,
      'Recepciones Registradas:',
      items.length,
    ];
    sheet.getRow(5).font = { name: 'Calibri', size: 9.5, bold: true };
    sheet.getCell('C5').numFmt = '"Bs. "#,##0.00';

    // 4. Encabezados de la tabla (Fila 7)
    const headerRow = sheet.getRow(7);
    headerRow.values = [
      'Fecha Recepción',
      'Proveedor',
      'Nro. Orden',
      'Nro. Recepción',
      'Producto',
      'Color',
      'Talla',
      'Cantidad',
      'Costo Unitario (Bs.)',
      'Subtotal (Bs.)',
      'Total Recepción (Bs.)',
      'Sucursal Destino',
      'Responsable',
    ];
    headerRow.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF064FE8' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF064FE8' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      };
    });

    // 5. Filas de datos
    let currentRow = 8;
    for (const it of items) {
      const dateObj = it['fecha_recepcion'] ? new Date(String(it['fecha_recepcion'])) : null;
      const fechaStr = dateObj ? dateObj.toLocaleString('es-BO') : 'N/D';

      const row = sheet.getRow(currentRow);
      row.values = [
        fechaStr,
        String(it['proveedor'] || 'Sin proveedor'),
        it['id_orden_compra'] ? `#${it['id_orden_compra']}` : 'N/D',
        `#${it['id_recepcion'] || 'N/D'}`,
        String(it['producto'] || 'N/D'),
        String(it['color'] || '-'),
        String(it['talla'] || '-'),
        Number(it['cantidad'] || 0),
        Number(it['precio_unitario'] || 0),
        Number(it['subtotal'] || 0),
        Number(it['total_compra'] || 0),
        String(it['sucursal'] || 'Central'),
        String(it['usuario_responsable'] || 'No disponible'),
      ];

      row.font = { name: 'Calibri', size: 9.5 };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(9).numFmt = '"Bs. "#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right' };
      row.getCell(10).numFmt = '"Bs. "#,##0.00';
      row.getCell(11).alignment = { horizontal: 'right' };
      row.getCell(11).numFmt = '"Bs. "#,##0.00';

      if (currentRow % 2 === 0) {
        row.eachCell((cell, colNumber) => {
          if (colNumber <= 13) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        });
      }

      currentRow++;
    }

    // 6. Fila final de totales
    const totalRow = sheet.getRow(currentRow);
    totalRow.values = [
      'TOTAL COMPRAS CONSOLIDADO',
      '',
      '',
      '',
      '',
      '',
      '',
      totalPrendas,
      '',
      totalInvertido,
      '',
      '',
      `${items.length} recepciones`,
    ];
    totalRow.font = { name: 'Calibri', size: 10, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'left' };
    totalRow.getCell(8).alignment = { horizontal: 'center' };
    totalRow.getCell(10).alignment = { horizontal: 'right' };
    totalRow.getCell(10).numFmt = '"Bs. "#,##0.00';
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };
    });

    // 7. Anchos de columnas
    sheet.columns = [
      { width: 18 }, // Fecha Recepción
      { width: 26 }, // Proveedor
      { width: 13 }, // Nro Orden
      { width: 14 }, // Nro Recepción
      { width: 26 }, // Producto
      { width: 14 }, // Color
      { width: 10 }, // Talla
      { width: 11 }, // Cantidad
      { width: 18 }, // Costo Unitario
      { width: 17 }, // Subtotal
      { width: 19 }, // Total Recepción
      { width: 22 }, // Sucursal
      { width: 24 }, // Responsable
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadBlob(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `historial_compras_${dateStr}.xlsx`,
    );
  }

  /**
   * Exporta las compras a proveedores a un reporte imprimible/PDF con el logo oficial.
   */
  exportPurchasesToPdf(
    items: Array<Record<string, string | number | null>>,
    filters: PurchasesFilterInfo,
  ): void {
    const dateStr = new Date().toLocaleString('es-BO');
    const totalInvertido = items.reduce((sum, it) => sum + (Number(it['subtotal']) || 0), 0);
    const totalPrendas = items.reduce((sum, it) => sum + (Number(it['cantidad']) || 0), 0);

    const rowsHtml = items
      .map((it) => {
        const dateObj = it['fecha_recepcion'] ? new Date(String(it['fecha_recepcion'])) : null;
        const fechaStr = dateObj ? dateObj.toLocaleDateString('es-BO') : 'N/D';
        const horaStr = dateObj ? dateObj.toLocaleTimeString('es-BO') : '';

        return `
          <tr>
            <td>
              <div>${fechaStr}</div>
              <small style="color: #64748b; font-size: 0.75rem;">${horaStr}</small>
            </td>
            <td><strong>${it['proveedor'] || 'Sin proveedor'}</strong></td>
            <td style="text-align: center;">#${it['id_orden_compra'] || 'N/D'} / #${it['id_recepcion']}</td>
            <td>
              <div>${it['producto']}</div>
              <small style="color: #64748b; font-size: 0.75rem;">${it['color']} / ${it['talla']}</small>
            </td>
            <td style="text-align: center; font-weight: 700;">${it['cantidad']}</td>
            <td style="text-align: right;">Bs. ${Number(it['precio_unitario'] || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="text-align: right; font-weight: 700; color: #064fe8;">Bs. ${Number(it['subtotal'] || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>${it['sucursal']}</td>
            <td>${it['usuario_responsable'] || 'No disponible'}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Reporte de Compras - Capricho Store</title>
        <style>
          @page {
            size: letter landscape;
            margin: 10mm 12mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 11px;
            background: #ffffff;
          }
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #064fe8;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .report-brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .report-brand img {
            height: 52px;
            width: auto;
            object-fit: contain;
          }
          .report-brand-text h1 {
            font-size: 16px;
            margin: 0;
            letter-spacing: 0.05em;
            color: #0f172a;
            font-weight: 800;
          }
          .report-brand-text p {
            margin: 2px 0 0;
            font-size: 9.5px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .report-meta {
            text-align: right;
            font-size: 9.5px;
            color: #475569;
          }
          .report-meta strong {
            font-size: 13px;
            color: #064fe8;
            display: block;
            margin-bottom: 2px;
          }
          .report-filters {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 12px;
            margin-bottom: 12px;
            font-size: 10px;
            display: flex;
            gap: 16px;
          }
          .report-filters span {
            color: #475569;
          }
          .report-filters strong {
            color: #0f172a;
          }
          .kpi-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            background: #ffffff;
            border-left: 3px solid #064fe8;
          }
          .kpi-card__label {
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
          }
          .kpi-card__val {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin: 2px 0;
          }
          .kpi-card__sub {
            font-size: 8.5px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
          }
          th {
            background: #0f172a;
            color: #ffffff;
            padding: 6px 8px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            text-align: left;
          }
          td {
            padding: 5px 8px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          .total-row td {
            font-weight: 800;
            font-size: 10.5px;
            background: #e2e8f0 !important;
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
          }
          .report-footer {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="report-brand">
            <img src="${LOGO_CAPRICHO_BASE64}" alt="Capricho Store Logo" />
            <div class="report-brand-text">
              <h1>CAPRICHO STORE</h1>
              <p>Módulo de Compras & Abastecimiento</p>
            </div>
          </div>
          <div class="report-meta">
            <strong>HISTORIAL DE COMPRAS A PROVEEDORES</strong>
            <span>Emisión: ${dateStr}</span>
          </div>
        </div>

        <div class="report-filters">
          <div><span>Proveedor:</span> <strong>${filters.supplier}</strong></div>
          <div><span>Sucursal:</span> <strong>${filters.branch}</strong></div>
          ${filters.period ? `<div><span>Período:</span> <strong>${filters.period}</strong></div>` : ''}
          ${filters.dateFrom ? `<div><span>Desde:</span> <strong>${filters.dateFrom}</strong></div>` : ''}
          ${filters.dateTo ? `<div><span>Hasta:</span> <strong>${filters.dateTo}</strong></div>` : ''}
          <div style="margin-left: auto;"><span>Registros:</span> <strong>${items.length} recepciones</strong></div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-card__label">Total Invertido en Compras</div>
            <div class="kpi-card__val">Bs. ${totalInvertido.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-card__sub">Costo total de abastecimiento</div>
          </div>
          <div class="kpi-card" style="border-left-color: #0284c7;">
            <div class="kpi-card__label">Prendas Ingresadas</div>
            <div class="kpi-card__val">${totalPrendas.toLocaleString('es-BO')} unidades</div>
            <div class="kpi-card__sub">Sumatoria física de inventario</div>
          </div>
          <div class="kpi-card" style="border-left-color: #10b981;">
            <div class="kpi-card__label">Total Recepciones</div>
            <div class="kpi-card__val">${items.length} partidas</div>
            <div class="kpi-card__sub">Lotes recibidos en almacén</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 85px;">Fecha</th>
              <th>Proveedor</th>
              <th style="width: 100px; text-align: center;">Orden / Recepción</th>
              <th>Producto y Variante</th>
              <th style="width: 55px; text-align: center;">Cantidad</th>
              <th style="width: 85px; text-align: right;">Costo Unit.</th>
              <th style="width: 90px; text-align: right;">Subtotal</th>
              <th>Sucursal</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="4">TOTAL COMPRAS CONSOLIDADO (${items.length} RECEPCIONES)</td>
              <td style="text-align: center;">${totalPrendas}</td>
              <td></td>
              <td style="text-align: right;">Bs. ${totalInvertido.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>

        <div class="report-footer">
          <span>Capricho Store - Sistema Administrativo Integral</span>
          <span>Impreso el ${dateStr}</span>
        </div>
      </body>
      </html>
    `;

    this.openPrintWindow(htmlContent);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private openPrintWindow(htmlContent: string): void {
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes (popups) para imprimir o descargar el PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
}
