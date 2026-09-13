import io
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


@dataclass
class InvoiceItem:
    marca: str
    producto: str
    color: str
    talla: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


@dataclass
class InvoiceData:
    numero_factura: str
    fecha_emision: datetime
    estado_pago: str
    # Store
    tienda_nombre: str = "CAPRICHO STORE"
    tienda_nit: str = "102938475"
    sucursal_nombre: str = "Sucursal Principal"
    sucursal_direccion: str = "Santa Cruz de la Sierra, Bolivia"
    sucursal_telefono: str = "+591 70000000"
    # Customer
    cliente_nombre: str = "Consumidor Final"
    cliente_doc: str = "S/N"
    cliente_correo: str = ""
    cliente_telefono: str = ""
    modalidad_entrega: str = "DELIVERY"
    destino_entrega: str = "Entrega a domicilio"
    # Totals
    subtotal: Decimal = Decimal("0.00")
    descuento: Decimal = Decimal("0.00")
    costo_envio: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    metodo_pago: str = "Tarjeta de Crédito / Débito (Stripe)"
    items: list[InvoiceItem] = field(default_factory=list)


def _under_thousand_es(num: int) -> str:
    if num == 0:
        return ""
    if num == 100:
        return "cien"
    u = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]
    d1 = [
        "diez",
        "once",
        "doce",
        "trece",
        "catorce",
        "quince",
        "dieciséis",
        "diecisiete",
        "dieciocho",
        "diecinueve",
    ]
    d = [
        "",
        "",
        "veinte",
        "treinta",
        "cuarenta",
        "cincuenta",
        "sesenta",
        "setenta",
        "ochenta",
        "noventa",
    ]
    c = [
        "",
        "ciento",
        "doscientos",
        "trescientos",
        "cuatrocientos",
        "quinientos",
        "seiscientos",
        "setecientos",
        "ochocientos",
        "novecientos",
    ]
    res = []
    if num >= 100:
        res.append(c[num // 100])
        num %= 100
    if 10 <= num <= 19:
        res.append(d1[num - 10])
    elif 21 <= num <= 29:
        res.append("veinti" + ("un" if num == 21 else u[num - 20]))
    elif num >= 20:
        dec = d[num // 10]
        uni = u[num % 10]
        res.append(dec + (" y " + uni if uni else ""))
    elif num > 0:
        res.append(u[num])
    return " ".join(res)


def amount_to_words_es(amount: Decimal | float | int) -> str:
    val = Decimal(str(amount))
    integer_part = int(val)
    cents = int(round((val - integer_part) * 100))

    if integer_part == 0:
        words = "Cero"
    else:
        parts = []
        n = integer_part
        millions = n // 1_000_000
        n %= 1_000_000
        thousands = n // 1000
        remainder = n % 1000

        if millions == 1:
            parts.append("un millón")
        elif millions > 1:
            parts.append(f"{_under_thousand_es(millions)} millones")

        if thousands == 1:
            parts.append("mil")
        elif thousands > 1:
            parts.append(f"{_under_thousand_es(thousands)} mil")

        if remainder > 0:
            parts.append(_under_thousand_es(remainder))

        words = " ".join(parts).strip().capitalize()

    return f"{words} {cents:02d}/100 Bolivianos"


def generate_invoice_pdf(data: InvoiceData) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_style = ParagraphStyle(
        "BrandTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#064fe8"),
    )
    doc_title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        alignment=2,  # Right
        textColor=colors.HexColor("#101828"),
    )
    meta_left_style = ParagraphStyle(
        "MetaLeft",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=12,
        textColor=colors.HexColor("#475467"),
    )
    meta_right_style = ParagraphStyle(
        "MetaRight",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=12,
        alignment=2,  # Right
        textColor=colors.HexColor("#475467"),
    )
    card_label_style = ParagraphStyle(
        "CardLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
    )
    card_val_style = ParagraphStyle(
        "CardVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )
    th_style = ParagraphStyle(
        "TH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        alignment=1,  # Center
        textColor=colors.white,
    )
    th_left_style = ParagraphStyle(
        "THLeft",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.white,
    )
    td_style = ParagraphStyle(
        "TD",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
    )
    td_center_style = ParagraphStyle(
        "TDCenter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=1,  # Center
        textColor=colors.HexColor("#1e293b"),
    )
    td_right_style = ParagraphStyle(
        "TDRight",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=2,  # Right
        textColor=colors.HexColor("#1e293b"),
    )

    story = []

    # 1. Header (Brand vs Invoice Title)
    fecha_str = (
        data.fecha_emision.strftime("%d/%m/%Y %H:%M")
        if data.fecha_emision
        else datetime.now().strftime("%d/%m/%Y %H:%M")
    )
    header_table = Table(
        [
            [
                Paragraph(f"<b>{data.tienda_nombre}</b>", brand_style),
                Paragraph("<b>FACTURA / NOTA DE VENTA</b>", doc_title_style),
            ],
            [
                Paragraph(
                    f"NIT: <b>{data.tienda_nit}</b><br/>"
                    f"{data.sucursal_nombre}<br/>"
                    f"{data.sucursal_direccion}<br/>"
                    f"Tel: {data.sucursal_telefono}",
                    meta_left_style,
                ),
                Paragraph(
                    f"N°: <b>{data.numero_factura}</b><br/>"
                    f"Fecha: {fecha_str}<br/>"
                    f"Estado: <font color='#0a7337'><b>{data.estado_pago}</b></font>",
                    meta_right_style,
                ),
            ],
        ],
        colWidths=[310, 210],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 12))

    # Divider
    story.append(
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=10)
    )

    # 2. Customer & Delivery Info Card
    modalidad_str = (
        "Delivery a domicilio" if data.modalidad_entrega == "DELIVERY" else "Retiro en sucursal"
    )
    cust_data = [
        [
            Paragraph("DATOS DEL CLIENTE", card_label_style),
            Paragraph("DETALLES DE ENTREGA", card_label_style),
        ],
        [
            Paragraph(
                f"<b>Cliente:</b> {data.cliente_nombre}<br/>"
                f"<b>NIT / CI:</b> {data.cliente_doc}<br/>"
                f"<b>Correo:</b> {data.cliente_correo or 'No registrado'}<br/>"
                f"<b>Teléfono:</b> {data.cliente_telefono or 'No registrado'}",
                card_val_style,
            ),
            Paragraph(
                f"<b>Modalidad:</b> {modalidad_str}<br/>"
                f"<b>Destino:</b> {data.destino_entrega}<br/>"
                f"<b>Método de Pago:</b> {data.metodo_pago}",
                card_val_style,
            ),
        ],
    ]
    cust_table = Table(cust_data, colWidths=[260, 260])
    cust_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(cust_table)
    story.append(Spacer(1, 14))

    # 3. Table of Items: MARCA | PRODUCTO | COLOR | TALLA | CANT | P. UNIT. | SUBTOTAL
    # Total width available: 520pt
    # Col widths: 70, 140, 75, 45, 35, 75, 80
    items_header = [
        Paragraph("MARCA", th_left_style),
        Paragraph("PRODUCTO", th_left_style),
        Paragraph("COLOR", th_left_style),
        Paragraph("TALLA", th_style),
        Paragraph("CANT", th_style),
        Paragraph("P. UNIT.", th_style),
        Paragraph("SUBTOTAL", th_style),
    ]
    rows = [items_header]

    for it in data.items:
        rows.append(
            [
                Paragraph(it.marca, td_style),
                Paragraph(it.producto, td_style),
                Paragraph(it.color, td_style),
                Paragraph(it.talla, td_center_style),
                Paragraph(str(it.cantidad), td_center_style),
                Paragraph(f"Bs. {it.precio_unitario:.2f}", td_right_style),
                Paragraph(f"Bs. {it.subtotal:.2f}", td_right_style),
            ]
        )

    items_table = Table(rows, colWidths=[70, 140, 75, 45, 35, 75, 80])
    table_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#064fe8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]
    # Alternating row background
    for i in range(1, len(rows)):
        bg = colors.HexColor("#ffffff") if i % 2 != 0 else colors.HexColor("#f8fafc")
        table_styles.append(("BACKGROUND", (0, i), (-1, i), bg))

    items_table.setStyle(TableStyle(table_styles))
    story.append(items_table)
    story.append(Spacer(1, 10))

    # 4. Totals Block & Literal
    literal_text = amount_to_words_es(data.total)
    totals_data = [
        [
            Paragraph(f"<b>SON:</b> {literal_text}", card_val_style),
            Paragraph("Subtotal Prendas:", td_right_style),
            Paragraph(f"Bs. {data.subtotal:.2f}", td_right_style),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Descuento:", td_right_style),
            Paragraph(f"-Bs. {data.descuento:.2f}", td_right_style),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Costo de Envío:", td_right_style),
            Paragraph(f"Bs. {data.costo_envio:.2f}", td_right_style),
        ],
        [
            Paragraph("", td_style),
            Paragraph("<b>TOTAL A PAGAR:</b>", td_right_style),
            Paragraph(
                f"<b><font size=10 color='#064fe8'>Bs. {data.total:.2f}</font></b>",
                td_right_style,
            ),
        ],
    ]
    totals_table = Table(totals_data, colWidths=[310, 110, 100])
    totals_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LINEABOVE", (1, -1), (2, -1), 1, colors.HexColor("#064fe8")),
                ("BACKGROUND", (1, -1), (2, -1), colors.HexColor("#f0fdf4")),
            ]
        )
    )
    story.append(totals_table)
    story.append(Spacer(1, 16))

    # 5. Footer Notice
    footer_text = (
        "<b>¡Gracias por tu compra en Capricho Store!</b><br/>"
        "Garantía y cambios hasta 7 días presentando este comprobante en cualquiera de "
        "nuestras sucursales.<br/>"
        "Este documento es un respaldo digital oficial de la transacción comercial."
    )
    footer_p = Paragraph(
        f"<font size=7 color='#64748b'>{footer_text}</font>",
        ParagraphStyle("Footer", parent=styles["Normal"], alignment=1, leading=10),
    )
    story.append(
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=8)
    )
    story.append(footer_p)

    doc.build(story)
    return buffer.getvalue()
