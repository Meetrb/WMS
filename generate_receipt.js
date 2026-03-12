import fs from "fs";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    PageOrientation
} from "docx";

const generateDoc = async () => {

    // Helper to create table cells with consistent styling
    const createCell = (text, isHeader = false, colSpan = 1, alignment = AlignmentType.LEFT, bgColor = undefined) => {
        return new TableCell({
            children: [new Paragraph({
                children: [new TextRun({
                    text: text,
                    bold: isHeader,
                    size: 18 // 9pt
                })],
                alignment: alignment
            })],
            columnSpan: colSpan,
            shading: bgColor ? { fill: bgColor } : undefined,
            margins: { top: 60, bottom: 60, left: 60, right: 60 }
        });
    };

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 1 inch
                    size: {
                        orientation: PageOrientation.PORTRAIT,
                    }
                }
            },
            children: [
                // Header Bar
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: "Inbound ID: INB-2024-001", bold: true, size: 20 })] })],
                                    shading: { fill: "FEF3C7" },
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                }),
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: "PO No: PO-1001", bold: true, size: 20 })] })],
                                    shading: { fill: "FEF3C7" },
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                }),
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: "Container No: CN-789012", bold: true, size: 20 })] })],
                                    shading: { fill: "FEF3C7" },
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                }),
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString()}`, bold: true, size: 20 })] })],
                                    shading: { fill: "FEF3C7" },
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                }),
                            ]
                        })
                    ]
                }),
                new Paragraph(""), // Spacing

                // Company Info section
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "COMPANY & WAREHOUSE INFO", bold: true })] }),
                                        new Paragraph("Warehouse Name: Global Logistics Hub"),
                                        new Paragraph("Address: 123 Commerce Drive, Industrial Park, Cityville, State, ZIP"),
                                        new Paragraph("Contact: +1-555-0100, warehouse@globalhub.com"),
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "INBOUND RECEIPT", bold: true, size: 32 })], alignment: AlignmentType.RIGHT }),
                                        new Paragraph({ children: [new TextRun({ text: `Generated Date: ${new Date().toISOString().split('T')[0]}` })], alignment: AlignmentType.RIGHT }),
                                    ]
                                })
                            ]
                        })
                    ]
                }),
                new Paragraph(""),

                // Information Tables
                new Paragraph({ children: [new TextRun({ text: "INBOUND INFORMATION", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createCell("Inbound ID:", true), createCell("INB-2024-001"),
                                createCell("Arrival Date:", true), createCell("2024-02-20"),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("PO Number:", true), createCell("PO-1001"),
                                createCell("Received Date:", true), createCell("2024-02-20"),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Container:", true), createCell("CN-789012"),
                                createCell("Total POs:", true), createCell("1"),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Status:", true), createCell("Arrived"),
                                createCell("Total SKUs:", true), createCell("2"),
                            ]
                        }),
                    ]
                }),
                new Paragraph(""),

                // Vendor & PO Details
                new Paragraph({ children: [new TextRun({ text: "VENDOR & PO DETAILS LIST", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createCell("PO ID", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                createCell("Vendor Name", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                createCell("PO Date", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                createCell("Exp. Qty", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                                createCell("Rcv. Qty", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                                createCell("PO Status", true, 1, AlignmentType.CENTER, "E5E7EB"),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("PO-1001"),
                                createCell("Global Tech"),
                                createCell("2024-02-01"),
                                createCell("700", false, 1, AlignmentType.RIGHT),
                                createCell("695", false, 1, AlignmentType.RIGHT),
                                createCell("Arrived", false, 1, AlignmentType.CENTER),
                            ]
                        })
                    ]
                }),
                new Paragraph(""),

                // Detailed Items
                new Paragraph({ children: [new TextRun({ text: "DETAILED ITEM RECEIVING TABLE", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createCell("SKU", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                createCell("Description", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                createCell("Unit", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                createCell("Exp", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                                createCell("Rcv", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                                createCell("Acc", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                                createCell("Batch", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                createCell("Dmg", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("WM-001"),
                                createCell("Wireless Mouse"),
                                createCell("EA"),
                                createCell("500", false, 1, AlignmentType.RIGHT),
                                createCell("500", false, 1, AlignmentType.RIGHT),
                                createCell("500", false, 1, AlignmentType.RIGHT),
                                createCell("BATCH-001"),
                                createCell("0", false, 1, AlignmentType.RIGHT),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("MK-002"),
                                createCell("Mechanical Keyboard"),
                                createCell("EA"),
                                createCell("200", false, 1, AlignmentType.RIGHT),
                                createCell("195", false, 1, AlignmentType.RIGHT),
                                createCell("190", false, 1, AlignmentType.RIGHT),
                                createCell("BATCH-002"),
                                createCell("5", false, 1, AlignmentType.RIGHT),
                            ]
                        })
                    ]
                }),
                new Paragraph(""),

                // Summary
                new Paragraph({ children: [new TextRun({ text: "RECEIVING SUMMARY", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createCell("Total Expected Qty:", true), createCell("700"),
                                createCell("Total Accepted Qty:", true), createCell("690"),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Total Received Qty:", true), createCell("695"),
                                createCell("Total Damaged Qty:", true), createCell("5"),
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Variance:", true), createCell("5"),
                                createCell("Total Rejected Qty:", true), createCell("0"),
                            ]
                        })
                    ]
                }),
                new Paragraph(""),

                // Signatures
                new Paragraph(""),
                new Paragraph(""),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "___________________________" })], alignment: AlignmentType.CENTER }),
                                        new Paragraph({ children: [new TextRun({ text: "GRN Manager Signature", bold: true })], alignment: AlignmentType.CENTER }),
                                        new Paragraph({ children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString()}`, size: 16 })], alignment: AlignmentType.CENTER })
                                    ]
                                }),
                                new TableCell({
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "___________________________" })], alignment: AlignmentType.CENTER }),
                                        new Paragraph({ children: [new TextRun({ text: "Warehouse Supervisor", bold: true })], alignment: AlignmentType.CENTER }),
                                        new Paragraph({ children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString()}`, size: 16 })], alignment: AlignmentType.CENTER })
                                    ]
                                }),
                                new TableCell({
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "___________________________" })], alignment: AlignmentType.CENTER }),
                                        new Paragraph({ children: [new TextRun({ text: "Transporter Signature", bold: true })], alignment: AlignmentType.CENTER }),
                                        new Paragraph({ children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString()}`, size: 16 })], alignment: AlignmentType.CENTER })
                                    ]
                                })
                            ]
                        })
                    ]
                })

            ]
        }]
    });

    const b64string = await Packer.toBuffer(doc);
    fs.writeFileSync("Inbound_Receipt_Template.docx", b64string);
    console.log("Template generated successfully at Inbound_Receipt_Template.docx");
}

generateDoc().catch(console.error);
