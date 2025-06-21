const PDFDocument = require('pdfkit');
class PDFGenerator {
    static async generatePDF(data, dataType) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument();
                const buffers = [];

                // Collect PDF data
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // PDF Header
                doc.fontSize(20).text(`${dataType.toUpperCase()} Export Report`, 50, 50);
                doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, 50, 80);
                doc.fontSize(12).text(`Total Records: ${data.length}`, 50, 100);

                // Add separator line
                doc.moveTo(50, 120).lineTo(550, 120).stroke();

                let yPosition = 140;

                // Generate content based on data type
                switch (dataType) {
                    case 'suppliers':
                        yPosition = this.generateSuppliersContent(doc, data, yPosition);
                        break;
                    case 'parts':
                        yPosition = this.generatePartsContent(doc, data, yPosition);
                        break;
                    case 'appointments':
                        yPosition = this.generateAppointmentsContent(doc, data, yPosition);
                        break;
                }

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    static generateSuppliersContent(doc, suppliers, startY) {
        let yPos = startY;

        suppliers.forEach((supplier, index) => {
            // Check if we need a new page
            if (yPos > 700) {
                doc.addPage();
                yPos = 50;
            }

            doc.fontSize(14).text(`${index + 1}. ${supplier.company_name}`, 50, yPos);
            yPos += 20;

            doc.fontSize(10)
                .text(`Contact: ${supplier.contact_person}`, 70, yPos)
                .text(`Email: ${supplier.email}`, 70, yPos + 15)
                .text(`Phone: ${supplier.phone || 'N/A'}`, 70, yPos + 30)
                .text(`Address: ${supplier.address || 'N/A'}`, 70, yPos + 45)
                .text(`Delivery Time: ${supplier.delivery_time_days} days`, 70, yPos + 60);

            yPos += 90;

            // Add separator line
            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            yPos += 10;
        });

        return yPos;
    }

    static generatePartsContent(doc, parts, startY) {
        let yPos = startY;

        parts.forEach((part, index) => {
            if (yPos > 680) {
                doc.addPage();
                yPos = 50;
            }

            doc.fontSize(14).text(`${index + 1}. ${part.name}`, 50, yPos);
            yPos += 20;

            doc.fontSize(10)
                .text(`Description: ${part.description || 'N/A'}`, 70, yPos)
                .text(`Part Number: ${part.part_number || 'N/A'}`, 70, yPos + 15)
                .text(`Category: ${part.category || 'N/A'}`, 70, yPos + 30)
                .text(`Price: $${part.price}`, 70, yPos + 45)
                .text(`Stock: ${part.stock_quantity}`, 70, yPos + 60)
                .text(`Min Stock: ${part.minimum_stock_level}`, 70, yPos + 75)
                .text(`Supplier: ${part.supplier_name || 'N/A'}`, 70, yPos + 90);

            yPos += 120;

            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            yPos += 10;
        });

        return yPos;
    }

    static generateAppointmentsContent(doc, appointments, startY) {
        let yPos = startY;

        appointments.forEach((appointment, index) => {
            if (yPos > 650) {
                doc.addPage();
                yPos = 50;
            }

            doc.fontSize(14).text(`${index + 1}. Appointment #${appointment.id}`, 50, yPos);
            yPos += 20;

            const customerName = `${appointment.first_name || ''} ${appointment.last_name || ''}`.trim();
            const vehicleInfo = appointment.brand
                ? `${appointment.brand} ${appointment.model} (${appointment.year})`
                : 'N/A';

            doc.fontSize(10)
                .text(`Customer: ${customerName || 'N/A'}`, 70, yPos)
                .text(`Email: ${appointment.user_email || 'N/A'}`, 70, yPos + 15)
                .text(`Vehicle: ${vehicleInfo}`, 70, yPos + 30)
                .text(`Date: ${new Date(appointment.appointment_date).toLocaleString()}`, 70, yPos + 45)
                .text(`Status: ${appointment.status}`, 70, yPos + 60)
                .text(`Problem: ${appointment.problem_description}`, 70, yPos + 75)
                .text(`Estimated Price: $${appointment.estimated_price || 'TBD'}`, 70, yPos + 90);

            yPos += 120;

            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            yPos += 10;
        });

        return yPos;
    }
}

module.exports = PDFGenerator;