// controllers/adminAppointmentsController.js
const Appointment = require('../models/Appointment');

// Helper function pentru response JSON (similar cu cea din client)
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

class AdminAppointmentsController {
    // GET /admin/api/appointments - Get all appointments for admin dashboard
    static async getAppointmentsForAdmin(req, res) {
        try {
            const { status, date_filter, search } = req.query;

            const filters = {};
            if (status && status !== 'all') {
                filters.status = status;
            }
            if (date_filter && date_filter !== 'all') {
                filters.date_filter = date_filter;
            }

            console.log('Loading appointments for admin with filters:', filters);

            const appointments = await Appointment.getAllForAdmin(filters);

            // Format appointments for admin dashboard
            let formattedAppointments = appointments.map(appointment => ({
                id: appointment.id,
                clientName: `${appointment.first_name} ${appointment.last_name}`,
                clientEmail: appointment.email,
                clientPhone: appointment.phone,
                appointmentDate: appointment.appointment_date,
                status: appointment.status,
                problemDescription: appointment.problem_description,
                adminResponse: appointment.admin_response,
                estimatedPrice: appointment.estimated_price,
                estimatedCompletionTime: appointment.estimated_completion_time,
                warrantyInfo: appointment.warranty_info,
                serviceType: appointment.vehicle_type ?
                    `${appointment.vehicle_type} ${appointment.brand} ${appointment.model}${appointment.year ? ` (${appointment.year})` : ''}` :
                    'Vehicul necunoscut',
                vehicleInfo: {
                    type: appointment.vehicle_type,
                    brand: appointment.brand,
                    model: appointment.model,
                    year: appointment.year,
                    isElectric: appointment.is_electric
                },
                createdAt: appointment.created_at,
                updatedAt: appointment.updated_at
            }));

            // Apply search filter if provided
            if (search && search.trim()) {
                const searchTerm = search.toLowerCase().trim();
                formattedAppointments = formattedAppointments.filter(appointment =>
                    appointment.clientName.toLowerCase().includes(searchTerm) ||
                    appointment.clientEmail.toLowerCase().includes(searchTerm) ||
                    appointment.problemDescription.toLowerCase().includes(searchTerm) ||
                    appointment.serviceType.toLowerCase().includes(searchTerm)
                );
            }

            console.log(`Found ${formattedAppointments.length} appointments for admin`);

            sendJSON(res, 200, {
                success: true,
                message: 'Programări încărcate cu succes',
                appointments: formattedAppointments,
                total: formattedAppointments.length
            });

        } catch (error) {
            console.error('Error fetching appointments for admin:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Eroare la încărcarea programărilor'
            });
        }
    }

    // GET /admin/api/appointments/:id - Get single appointment details for admin
    static async getAppointmentDetails(req, res) {
        try {
            const appointmentId = parseInt(req.params.id);

            if (!appointmentId || appointmentId <= 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'ID programare invalid'
                });
            }

            console.log(`Loading appointment details for ID: ${appointmentId}`);

            const appointment = await Appointment.getByIdForAdmin(appointmentId);

            if (!appointment) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Programarea nu a fost găsită'
                });
            }

            // Get appointment media files
            const mediaFiles = await Appointment.getAppointmentMedia(appointmentId);

            // Format appointment details for admin
            const formattedAppointment = {
                id: appointment.id,
                clientInfo: {
                    name: `${appointment.first_name} ${appointment.last_name}`,
                    email: appointment.email,
                    phone: appointment.phone
                },
                appointmentDate: appointment.appointment_date,
                status: appointment.status,
                problemDescription: appointment.problem_description,
                adminResponse: appointment.admin_response,
                estimatedPrice: appointment.estimated_price,
                estimatedCompletionTime: appointment.estimated_completion_time,
                warrantyInfo: appointment.warranty_info,
                vehicleInfo: {
                    type: appointment.vehicle_type,
                    brand: appointment.brand,
                    model: appointment.model,
                    year: appointment.year,
                    isElectric: appointment.is_electric,
                    notes: appointment.vehicle_notes
                },
                mediaFiles: mediaFiles.map(file => ({
                    id: file.id,
                    fileName: file.original_filename,
                    fileType: file.file_type,
                    filePath: file.file_path,
                    mimeType: file.mime_type,
                    uploadedAt: file.uploaded_at
                })),
                createdAt: appointment.created_at,
                updatedAt: appointment.updated_at
            };

            console.log('Appointment details loaded successfully');

            sendJSON(res, 200, {
                success: true,
                message: 'Detalii programare încărcate',
                appointment: formattedAppointment
            });

        } catch (error) {
            console.error('Error fetching appointment details:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Eroare la încărcarea detaliilor programării'
            });
        }
    }

    // PUT /admin/api/appointments/:id/status - Update appointment status (approve/reject)
    static async updateAppointmentStatus(req, res) {
        try {
            const appointmentId = parseInt(req.params.id);
            const { status, adminMessage, estimatedPrice, warranty, rejectionReason, retryDays } = req.body;

            if (!appointmentId || appointmentId <= 0) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'ID programare invalid'
                });
            }

            if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Status invalid'
                });
            }

            console.log(`Updating appointment ${appointmentId} to status: ${status}`);

            // Validate required fields based on status
            if (status === 'approved') {
                if (!estimatedPrice || estimatedPrice <= 0) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Prețul estimativ este obligatoriu pentru aprobare'
                    });
                }
                if (warranty === undefined || warranty === null || warranty < 0) {
                    return sendJSON(res, 400, {
                        success: false,
                        message: 'Garanția este obligatorie pentru aprobare'
                    });
                }
            }

            if (status === 'rejected' && !rejectionReason) {
                return sendJSON(res, 400, {
                    success: false,
                    message: 'Motivul respingerii este obligatoriu'
                });
            }

            // Build admin response message
            let adminResponse = adminMessage || '';

            if (status === 'rejected' && rejectionReason) {
                const rejectionReasons = {
                    'parts': 'Piese indisponibile',
                    'schedule': 'Program complet',
                    'expertise': 'În afara experienței noastre',
                    'other': 'Alt motiv'
                };

                const reasonText = rejectionReasons[rejectionReason] || rejectionReason;
                adminResponse += adminResponse ? `\n\nMotiv respingere: ${reasonText}` : `Motiv respingere: ${reasonText}`;

                if (retryDays && retryDays > 0) {
                    adminResponse += `\nReîncercați peste ${retryDays} zile.`;
                }
            }

            if (status === 'approved') {
                const approvalInfo = `Programarea a fost aprobată. Preț estimativ: ${estimatedPrice} RON. Garanție: ${warranty} luni.`;
                adminResponse = adminResponse ? `${adminResponse}\n\n${approvalInfo}` : approvalInfo;
            }

            const updateData = {
                status,
                adminResponse: adminResponse.trim(),
                estimatedPrice: status === 'approved' ? estimatedPrice : null,
                warrantyInfo: status === 'approved' ? `${warranty} luni garanție` : null
            };

            const updatedAppointment = await Appointment.updateStatus(appointmentId, updateData);

            if (!updatedAppointment) {
                return sendJSON(res, 404, {
                    success: false,
                    message: 'Programarea nu a fost găsită'
                });
            }

            const statusMessages = {
                'approved': 'Programarea a fost aprobată cu succes',
                'rejected': 'Programarea a fost respinsă',
                'pending': 'Programarea a fost setată în așteptare'
            };

            console.log(`Appointment ${appointmentId} updated successfully to status: ${status}`);

            sendJSON(res, 200, {
                success: true,
                message: statusMessages[status],
                appointment: {
                    id: updatedAppointment.id,
                    status: updatedAppointment.status,
                    adminResponse: updatedAppointment.admin_response,
                    estimatedPrice: updatedAppointment.estimated_price,
                    warrantyInfo: updatedAppointment.warranty_info,
                    updatedAt: updatedAppointment.updated_at
                }
            });

        } catch (error) {
            console.error('Error updating appointment status:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Eroare la actualizarea statusului programării'
            });
        }
    }

    // GET /admin/api/appointments/statistics - Get appointment statistics
    static async getAppointmentStatistics(req, res) {
        try {
            const statistics = await Appointment.getStatistics();

            sendJSON(res, 200, {
                success: true,
                statistics: statistics
            });

        } catch (error) {
            console.error('Error fetching appointment statistics:', error);
            sendJSON(res, 500, {
                success: false,
                message: 'Eroare la încărcarea statisticilor'
            });
        }
    }
}

module.exports = AdminAppointmentsController;