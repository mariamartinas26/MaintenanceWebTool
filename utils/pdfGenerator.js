const PDFDocument = require('pdfkit');

class PDFGenerator {
    static async generatePDF(data, dataType) {
        return new Promise((resolve, reject) => {
            try {
                //document pdf gol
                const doc = new PDFDocument();
                //array pentru a colecta toate datele pdf generate
                const buffers = [];

                doc.on('data', buffers.push.bind(buffers));
                //cand e gata pdf ul concateneaza toate bufferele si returneaza rezultatul
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                //header
                doc.fontSize(20).text(`${dataType.toUpperCase()} Export Report`, 50, 50);
                doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, 50, 80);
                doc.moveTo(50, 120).lineTo(550, 120).stroke(); //linie separatoare

                let yPosition = 140;

                //datele pe care le exportam in pdf
                switch (dataType) {
                    case 'suppliers':
                        this.generateSuppliersContent(doc, data, yPosition);
                        break;
                    case 'parts':
                        this.generatePartsContent(doc, data, yPosition);
                        break;
                    case 'appointments':
                        this.generateAppointmentsContent(doc, data, yPosition);
                        break;
                }
                doc.end();//finalizeaza documentul pdf
            } catch (error) {
                reject(error);
            }
        });
    }

    static generateSuppliersContent(doc, suppliers, startY) {
        let yPos = startY;
        let itemsOnPage = 0; //cate iteme sunt pe pagina curenta

        suppliers.forEach((supplier, index) => {
            //facem o pagina noua cand am adaugat 3 elemente pe pagina curenta
            if (itemsOnPage === 3) {
                doc.addPage();
                yPos = 50; //resetam pozitia y la inceput
                itemsOnPage = 0;
            }

            //afisam supplierul
            doc.fontSize(14).text(`${index + 1}. ${supplier.company_name}`, 50, yPos);
            yPos += 20;

            doc.fontSize(10)
                .text(`Contact: ${supplier.contact_person}`, 70, yPos)
                .text(`Email: ${supplier.email}`, 70, yPos + 15)
                .text(`Phone: ${supplier.phone }`, 70, yPos + 30)
                .text(`Address: ${supplier.address }`, 70, yPos + 45)
                .text(`Delivery Time: ${supplier.delivery_time_days} days`, 70, yPos + 60);

            yPos += 90;
            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            yPos += 15;
            itemsOnPage++;
        });
    }

    static generatePartsContent(doc, parts, startY) {
        let yPos = startY;
        let itemsOnPage = 0;

        parts.forEach((part, index) => {
            //pagina noua dupa 3 afisari
            if (itemsOnPage === 3) {
                doc.addPage();
                yPos = 50;
                itemsOnPage = 0;
            }

            //afisam piesa
            doc.fontSize(14).text(`${index + 1}. ${part.name}`, 50, yPos);
            yPos += 20;

            doc.fontSize(10)
                .text(`Description: ${part.description }`, 70, yPos)
                .text(`Part Number: ${part.part_number }`, 70, yPos + 15)
                .text(`Category: ${part.category}`, 70, yPos + 30)
                .text(`Price: ${part.price}`, 70, yPos + 45)
                .text(`Stock: ${part.stock_quantity}`, 70, yPos + 60)
                .text(`Min Stock: ${part.minimum_stock_level}`, 70, yPos + 75)
                .text(`Supplier: ${part.supplier_name }`, 70, yPos + 90);

            yPos += 120;
            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            yPos += 15;
            itemsOnPage++;
        });
    }

    static generateAppointmentsContent(doc, appointments, startY) {
        let yPos = startY;
        let itemsOnPage = 0;

        appointments.forEach((appointment, index) => {
            //pagina noua dupa 3 afisari
            if (itemsOnPage === 3) {
                doc.addPage();
                yPos = 50;
                itemsOnPage = 0;
            }

            //afisam programarea
            doc.fontSize(14).text(`${index + 1}. Appointment #${appointment.id}`, 50, yPos);
            yPos += 20;

            const customerName = `${appointment.first_name || ''} ${appointment.last_name || ''}`.trim();
            const vehicleInfo = appointment.brand
                ? `${appointment.brand} ${appointment.model} (${appointment.year})`
                : 'N/A';

            doc.fontSize(10)
                .text(`Customer: ${customerName }`, 70, yPos)
                .text(`Email: ${appointment.user_email }`, 70, yPos + 15)
                .text(`Vehicle: ${vehicleInfo}`, 70, yPos + 30)
                .text(`Date: ${new Date(appointment.appointment_date).toLocaleString()}`, 70, yPos + 45)
                .text(`Status: ${appointment.status}`, 70, yPos + 60)
                .text(`Problem: ${appointment.problem_description}`, 70, yPos + 75)
                .text(`Estimated Price: ${appointment.estimated_price || 'not yet'}`, 70, yPos + 90);

            yPos += 120;
            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            yPos += 15;
            itemsOnPage++;
        });
    }
}

module.exports = PDFGenerator;