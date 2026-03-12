import fs from 'fs';

const filePath = './src/pages/POManagementView.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add imports at the top
const importsToAdd = `import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle, AlignmentType, PageOrientation } from "docx";\nimport { saveAs } from "file-saver";\n`;

if (!content.includes('import { saveAs }')) {
    content = content.replace('import { Separator } from "@/components/ui/separator";', 'import { Separator } from "@/components/ui/separator";\n' + importsToAdd);
}

// 2. Extract the old printManifest function and replace it
const startPattern = 'const printManifest = (detail: ConsolidatedDetail) => {';
const endPattern = 'const handlePrintManifest = () => {';

const startIndex = content.indexOf(startPattern);
const endIndex = content.indexOf(endPattern);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find printManifest bounds.");
    process.exit(1);
}

const newPrintFunction = `const printManifest = async (detail: ConsolidatedDetail) => {
        // Mock data for fields not present in current model
        const warehouseInfo = {
            name: "Global Logistics Hub",
            address: "123 Commerce Drive, Industrial Park, Cityville, State, ZIP",
            contact: "+1-555-0100, warehouse@globalhub.com"
        };

        const products = detail.container ? detail.container.products.map(prod => {
            const details = MOCK_PRODUCT_DETAILS[prod.sku] || {};
            return { ...prod, ...details };
        }) : [];

        // Calculate summaries
        const totalExpectedQty = products.reduce((sum, p) => sum + p.orderedQty, 0);
        const totalReceivedQty = products.reduce((sum, p) => sum + p.receivedQty, 0);
        const totalDamageQty = products.reduce((sum, p) => sum + (p.damageQty || 0), 0);
        const totalAcceptedQty = totalReceivedQty - totalDamageQty;
        const variance = totalExpectedQty - totalReceivedQty;
        const totalSKUs = products.length;

        // Mock PO details based on available data
        // Split PO numbers if multiple are present
        const poNumbers = detail.poNumber.split(',').map(s => s.trim());

        const poList = poNumbers.map((poNum, index) => {
            const count = poNumbers.length;
            const exp = Math.floor(totalExpectedQty / count);
            const rcv = Math.floor(totalReceivedQty / count);

            return {
                id: poNum,
                vendor: detail.vendorName,
                vendorCode: \`V-\${990 + index}\`, 
                date: detail.orderDate,
                expQty: index === count - 1 ? totalExpectedQty - (exp * (count - 1)) : exp, 
                rcvQty: index === count - 1 ? totalReceivedQty - (rcv * (count - 1)) : rcv,
                status: detail.inboundStatus
            };
        });

        const createCell = (text: string, isHeader = false, colSpan = 1, alignment = AlignmentType.LEFT, bgColor?: string) => {
            return new DocxTableCell({
                children: [new Paragraph({
                    children: [new TextRun({ 
                        text: String(text), 
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
                        size: { orientation: PageOrientation.PORTRAIT }
                    }
                },
                children: [
                    // Header Bar
                    new DocxTable({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new DocxTableRow({
                                children: [
                                    new DocxTableCell({
                                        children: [new Paragraph({ children: [new TextRun({ text: \`Inbound ID: \${detail.inboundId}\`, bold: true, size: 20 })] })],
                                        shading: { fill: "FEF3C7" }, margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                    }),
                                    new DocxTableCell({
                                        children: [new Paragraph({ children: [new TextRun({ text: \`PO No: \${detail.poNumber}\`, bold: true, size: 20 })] })],
                                        shading: { fill: "FEF3C7" }, margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                    }),
                                    new DocxTableCell({
                                        children: [new Paragraph({ children: [new TextRun({ text: \`Container No: \${detail.container?.containerId || 'N/A'}\`, bold: true, size: 20 })] })],
                                        shading: { fill: "FEF3C7" }, margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                    }),
                                    new DocxTableCell({
                                        children: [new Paragraph({ children: [new TextRun({ text: \`Date: \${new Date().toLocaleDateString()}\`, bold: true, size: 20 })] })],
                                        shading: { fill: "FEF3C7" }, margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                    }),
                                ]
                            })
                        ]
                    }),
                    new Paragraph(""), // Spacing
                    
                    // Company Info section
                    new DocxTable({
                         width: { size: 100, type: WidthType.PERCENTAGE },
                         rows: [
                             new DocxTableRow({
                                 children: [
                                     new DocxTableCell({
                                         width: { size: 50, type: WidthType.PERCENTAGE },
                                         children: [
                                             new Paragraph({ children: [new TextRun({ text: "COMPANY & WAREHOUSE INFO", bold: true })] }),
                                             new Paragraph(\`Warehouse Name: \${warehouseInfo.name}\`),
                                             new Paragraph(\`Address: \${warehouseInfo.address}\`),
                                             new Paragraph(\`Contact: \${warehouseInfo.contact}\`),
                                         ]
                                     }),
                                     new DocxTableCell({
                                         width: { size: 50, type: WidthType.PERCENTAGE },
                                         children: [
                                             new Paragraph({ children: [new TextRun({ text: "INBOUND RECEIPT", bold: true, size: 32 })], alignment: AlignmentType.RIGHT }),
                                             new Paragraph({ children: [new TextRun({ text: \`Generated Date: \${new Date().toISOString().split('T')[0]}\` })], alignment: AlignmentType.RIGHT }),
                                         ]
                                     })
                                 ]
                             })
                         ]
                    }),
                    new Paragraph(""),

                    // Information Tables
                    new Paragraph({ children: [new TextRun({ text: "INBOUND INFORMATION", bold: true })] }),
                    new DocxTable({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new DocxTableRow({
                                children: [
                                    createCell("Inbound ID:", true), createCell(detail.inboundId),
                                    createCell("Arrival Date:", true), createCell(detail.inboundDate),
                                ]
                            }),
                            new DocxTableRow({
                                children: [
                                     createCell("PO Number:", true), typeof detail.poNumber === "string" ? createCell(detail.poNumber) : createCell(detail.poNumber.join(", ")),
                                     createCell("Received Date:", true), createCell(detail.deliveryDate || '-'),
                                ]
                            }),
                             new DocxTableRow({
                                children: [
                                     createCell("Container:", true), createCell(detail.container?.containerId || 'N/A'),
                                     createCell("Total POs:", true), createCell(String(poList.length)),
                                ]
                            }),
                             new DocxTableRow({
                                children: [
                                     createCell("Status:", true), createCell(detail.inboundStatus),
                                     createCell("Total SKUs:", true), createCell(String(totalSKUs)),
                                ]
                            }),
                        ]
                    }),
                    new Paragraph(""),

                    // Vendor & PO Details
                    new Paragraph({ children: [new TextRun({ text: "VENDOR & PO DETAILS LIST", bold: true })] }),
                    new DocxTable({
                       width: { size: 100, type: WidthType.PERCENTAGE },
                       rows: [
                           new DocxTableRow({
                               children: [
                                   createCell("PO ID", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                   createCell("Vendor Name", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                   createCell("PO Date", true, 1, AlignmentType.LEFT, "E5E7EB"),
                                   createCell("Exp. Qty", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                                   createCell("Rcv. Qty", true, 1, AlignmentType.RIGHT, "E5E7EB"),
                                   createCell("PO Status", true, 1, AlignmentType.CENTER, "E5E7EB"),
                               ]
                           }),
                           ...poList.map(po => new DocxTableRow({
                               children: [
                                   createCell(po.id),
                                   createCell(po.vendor),
                                   createCell(po.date || '-'),
                                   createCell(String(po.expQty), false, 1, AlignmentType.RIGHT),
                                   createCell(String(po.rcvQty), false, 1, AlignmentType.RIGHT),
                                   createCell(po.status, false, 1, AlignmentType.CENTER),
                               ]
                           }))
                       ]
                    }),
                    new Paragraph(""),

                    // Detailed Items
                    new Paragraph({ children: [new TextRun({ text: "DETAILED ITEM RECEIVING TABLE", bold: true })] }),
                    new DocxTable({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new DocxTableRow({
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
                            ...products.map(p => new DocxTableRow({
                                 children: [
                                     createCell(p.sku),
                                     createCell(p.name),
                                     createCell(p.uom || 'EA'),
                                     createCell(String(p.orderedQty), false, 1, AlignmentType.RIGHT),
                                     createCell(String(p.receivedQty), false, 1, AlignmentType.RIGHT),
                                     createCell(String(p.receivedQty - (p.damageQty || 0)), false, 1, AlignmentType.RIGHT),
                                     createCell(p.batchNumber || '-'),
                                     createCell(String(p.damageQty || 0), false, 1, AlignmentType.RIGHT),
                                 ]
                            }))
                        ]
                    }),
                    new Paragraph(""),

                    // Summary
                    new Paragraph({ children: [new TextRun({ text: "RECEIVING SUMMARY", bold: true })] }),
                    new DocxTable({
                         width: { size: 100, type: WidthType.PERCENTAGE },
                         rows: [
                             new DocxTableRow({
                                 children: [
                                     createCell("Total Expected Qty:", true), createCell(String(totalExpectedQty)),
                                     createCell("Total Accepted Qty:", true), createCell(String(totalAcceptedQty)),
                                 ]
                             }),
                             new DocxTableRow({
                                 children: [
                                     createCell("Total Received Qty:", true), createCell(String(totalReceivedQty)),
                                     createCell("Total Damaged Qty:", true), createCell(String(totalDamageQty)),
                                 ]
                             }),
                              new DocxTableRow({
                                 children: [
                                     createCell("Variance:", true), createCell(String(variance)),
                                     createCell("Total Rejected Qty:", true), createCell("0"),
                                 ]
                             })
                         ]
                    }),
                    new Paragraph(""),

                    // Signatures
                    new Paragraph(""),
                    new Paragraph(""),
                    new DocxTable({
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
                            new DocxTableRow({
                                children: [
                                    new DocxTableCell({
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "___________________________" })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "GRN Manager Signature", bold: true })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: \`Date: \${new Date().toLocaleDateString()}\`, size: 16 })], alignment: AlignmentType.CENTER })
                                        ]
                                    }),
                                    new DocxTableCell({
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "___________________________" })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "Warehouse Supervisor", bold: true })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: \`Date: \${new Date().toLocaleDateString()}\`, size: 16 })], alignment: AlignmentType.CENTER })
                                        ]
                                    }),
                                    new DocxTableCell({
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "___________________________" })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "Transporter Signature", bold: true })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: \`Date: \${new Date().toLocaleDateString()}\`, size: 16 })], alignment: AlignmentType.CENTER })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })

                ]
            }]
        });

        try {
            const blob = await Packer.toBlob(doc);
            saveAs(blob, \`Inbound_Receipt_\${detail.inboundId}.docx\`);
            toast.success("Receipt downloaded successfully!");
        } catch (error) {
            console.error("Failed to generate document", error);
            toast.error("Failed to generate document.");
        }
    };

    `;

content = content.substring(0, startIndex) + newPrintFunction + content.substring(endIndex);

fs.writeFileSync(filePath, content);
console.log("Replaced successfully!");
