const PDFDocument = require('pdfkit');

class PDFGenerator {
    static generatePDF(data, dataType) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];

                // Colectează datele PDF-ului
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    resolve(pdfBuffer);
                });

                // Header
                doc.fontSize(20)
                    .font('Helvetica-Bold')
                    .text(`${dataType.toUpperCase()} EXPORT REPORT`, { align: 'center' });

                doc.moveDown();

                // Informații generale
                doc.fontSize(12)
                    .font('Helvetica')
                    .text(`Generated: ${new Date().toLocaleString('ro-RO')}`, { align: 'left' })
                    .text(`Total Records: ${data.length}`)
                    .text(`Data Type: ${dataType}`);

                doc.moveDown(2);

                // Generează conținutul bazat pe tipul de date
                switch (dataType) {
                    case 'suppliers':
                        this.generateSuppliersTable(doc, data);
                        break;
                    case 'parts':
                        this.generatePartsTable(doc, data);
                        break;
                    case 'appointments':
                        this.generateAppointmentsTable(doc, data);
                        break;
                    default:
                        doc.text('Unknown data type');
                }

                // Footer
                doc.fontSize(10)
                    .text(`Page ${doc.bufferedPageRange().count}`, 50, doc.page.height - 50, { align: 'center' });

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    static generateSuppliersTable(doc, suppliers) {
        doc.fontSize(16)
            .font('Helvetica-Bold')
            .text('Suppliers List', { align: 'left' });

        doc.moveDown();

        suppliers.forEach((supplier, index) => {
            if (index > 0) doc.moveDown();

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text(`${index + 1}. ${supplier.company_name || 'N/A'}`, { continued: false });

            doc.fontSize(10)
                .font('Helvetica')
                .text(`Contact: ${supplier.contact_person || 'N/A'}`)
                .text(`Email: ${supplier.email || 'N/A'}`)
                .text(`Phone: ${supplier.phone || 'N/A'}`)
                .text(`Address: ${supplier.address || 'N/A'}`)
                .text(`Delivery Time: ${supplier.delivery_time_days || 'N/A'} days`)
                .text(`Created: ${supplier.created_at ? new Date(supplier.created_at).toLocaleDateString('ro-RO') : 'N/A'}`);

            // Verifică dacă trebuie să adaugi o pagină nouă
            if (doc.y > 700) {
                doc.addPage();
            }
        });
    }

    static generatePartsTable(doc, parts) {
        doc.fontSize(16)
            .font('Helvetica-Bold')
            .text('Parts List', { align: 'left' });

        doc.moveDown();

        parts.forEach((part, index) => {
            if (index > 0) doc.moveDown();

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text(`${index + 1}. ${part.name || 'N/A'}`, { continued: false });

            doc.fontSize(10)
                .font('Helvetica')
                .text(`Part Number: ${part.part_number || 'N/A'}`)
                .text(`Description: ${part.description || 'N/A'}`)
                .text(`Category: ${part.category || 'N/A'}`)
                .text(`Price: ${part.price ? `$${part.price}` : 'N/A'}`)
                .text(`Stock: ${part.stock_quantity || 0}`)
                .text(`Min Stock: ${part.minimum_stock_level || 'N/A'}`)
                .text(`Supplier: ${part.supplier_name || 'N/A'}`)
                .text(`Created: ${part.created_at ? new Date(part.created_at).toLocaleDateString('ro-RO') : 'N/A'}`);

            if (doc.y > 700) {
                doc.addPage();
            }
        });
    }

    static generateAppointmentsTable(doc, appointments) {
        doc.fontSize(16)
            .font('Helvetica-Bold')
            .text('Appointments List', { align: 'left' });

        doc.moveDown();

        appointments.forEach((appointment, index) => {
            if (index > 0) doc.moveDown();

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text(`${index + 1}. Appointment #${appointment.id}`, { continued: false });

            doc.fontSize(10)
                .font('Helvetica')
                .text(`Client: ${appointment.first_name || ''} ${appointment.last_name || ''}`)
                .text(`Email: ${appointment.user_email || 'N/A'}`)
                .text(`Vehicle: ${appointment.brand || ''} ${appointment.model || ''} ${appointment.year || ''}`)
                .text(`Date: ${appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleDateString('ro-RO') : 'N/A'}`)
                .text(`Status: ${appointment.status || 'N/A'}`)
                .text(`Problem: ${appointment.problem_description || 'N/A'}`)
                .text(`Estimated Price: ${appointment.estimated_price ? `$${appointment.estimated_price}` : 'N/A'}`)
                .text(`Created: ${appointment.created_at ? new Date(appointment.created_at).toLocaleDateString('ro-RO') : 'N/A'}`);

            if (doc.y > 700) {
                doc.addPage();
            }
        });
    }
}

module.exports = PDFGenerator;