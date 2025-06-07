const { pool } = require('../database/db');

// Helper function pentru a extrage user ID din token
function getUserIdFromToken(authHeader) {
    console.log('Auth header received:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Invalid auth header format');
        return null;
    }

    const token = authHeader.substring(7);
    console.log('Token extracted:', token);

    // Pentru JWT-uri reale și fake tokens
    try {
        if (token.startsWith('fake_jwt_token_')) {
            const parts = token.split('_');
            const userId = parts.length >= 4 ? parseInt(parts[3]) : null;
            console.log('User ID extracted from fake token:', userId);
            return userId;
        }

        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const userId = payload.user_id || payload.userId || payload.id || payload.sub;
            console.log('User ID extracted from JWT:', userId);
            return userId ? parseInt(userId) : null;
        }
    } catch (error) {
        console.log('Error decoding token:', error);
    }

    // Fallback pentru testare
    console.log('Using fallback user ID: 1');
    return 1;
}

// Helper function pentru response JSON
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// GET /api/appointments - Obține programările utilizatorului din baza de date
async function getAppointments(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendJSON(res, 401, {
                success: false,
                message: 'Token invalid sau lipsă'
            });
        }

        console.log(`Loading appointments for user ID: ${userId}`);

        const query = `
            SELECT
                a.id,
                a.appointment_date,
                a.status,
                a.problem_description,
                a.admin_response,
                a.estimated_price,
                a.estimated_completion_time,
                a.created_at,
                a.updated_at,
                v.vehicle_type,
                v.brand,
                v.model,
                v.year
            FROM "Appointments" a
                     LEFT JOIN "Vehicles" v ON a.vehicle_id = v.id
            WHERE a.user_id = $1
            ORDER BY a.appointment_date DESC
        `;

        const result = await pool.query(query, [userId]);
        console.log(`Found ${result.rows.length} appointments in database for user ${userId}`);

        // Formatează datele pentru frontend
        const appointments = result.rows.map(row => ({
            id: row.id,
            date: row.appointment_date.toISOString().split('T')[0],
            time: row.appointment_date.toTimeString().slice(0, 5),
            status: row.status,
            serviceType: 'general',
            description: row.problem_description,
            adminResponse: row.admin_response,
            estimatedPrice: row.estimated_price,
            estimatedCompletionTime: row.estimated_completion_time,
            createdAt: row.created_at,
            vehicle: row.vehicle_type ? {
                type: row.vehicle_type,
                brand: row.brand,
                model: row.model,
                year: row.year
            } : null
        }));

        sendJSON(res, 200, {
            success: true,
            appointments: appointments
        });

    } catch (error) {
        console.error('Error getting appointments:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Eroare la obținerea programărilor'
        });
    }
}

// POST /api/appointments - Creează o programare nouă și actualizează calendarul
async function createAppointment(req, res, body) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendJSON(res, 401, {
                success: false,
                message: 'Token invalid sau lipsă'
            });
        }

        const { date, time, serviceType, description, vehicleId } = body;

        console.log('Creating appointment with data:', { date, time, serviceType, description, vehicleId });
        console.log('For user ID:', userId);

        // Validare date
        if (!date || !time || !description) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Data, ora și descrierea sunt obligatorii'
            });
        }

        if (description.trim().length < 10) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Descrierea trebuie să conțină cel puțin 10 caractere'
            });
        }

        // Creează timestamp-ul complet pentru programare
        const appointmentDateTime = new Date(`${date}T${time}:00`);

        // Verifică dacă data nu e în trecut
        const now = new Date();
        if (appointmentDateTime <= now) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Data și ora programării trebuie să fie în viitor'
            });
        }

        // Verifică dacă utilizatorul nu are deja o programare la același timp
        const existingAppointmentQuery = `
            SELECT id FROM "Appointments"
            WHERE user_id = $1
              AND appointment_date = $2
              AND status NOT IN ('cancelled', 'rejected')
        `;

        const existingResult = await pool.query(existingAppointmentQuery, [userId, appointmentDateTime]);

        if (existingResult.rows.length > 0) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Ai deja o programare activă la această dată și oră'
            });
        }

        // Verifică disponibilitatea în calendar
        const calendarQuery = `
            SELECT id, current_appointments, max_appointments
            FROM "Calendar"
            WHERE date = $1
              AND start_time <= $2::time
              AND end_time > $2::time
              AND is_available = true
        `;

        const calendarResult = await pool.query(calendarQuery, [date, time]);

        if (calendarResult.rows.length === 0) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Nu există sloturilor disponibile pentru această dată și oră'
            });
        }

        const calendarSlot = calendarResult.rows[0];

        if (calendarSlot.current_appointments >= calendarSlot.max_appointments) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Acest slot este complet ocupat'
            });
        }

        // Începe tranzacția pentru a actualiza atât Appointments cât și Calendar
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Inserează programarea în baza de date
            const insertAppointmentQuery = `
                INSERT INTO "Appointments" 
                (user_id, vehicle_id, appointment_date, status, problem_description, created_at, updated_at)
                VALUES ($1, $2, $3, 'pending', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `;

            const appointmentResult = await client.query(insertAppointmentQuery, [
                userId,
                vehicleId || null,
                appointmentDateTime,
                description.trim()
            ]);

            const newAppointment = appointmentResult.rows[0];

            // Actualizează contorul în calendar
            const updateCalendarQuery = `
                UPDATE "Calendar"
                SET current_appointments = current_appointments + 1
                WHERE id = $1
            `;

            await client.query(updateCalendarQuery, [calendarSlot.id]);

            // Adaugă în istoricul programărilor
            const historyQuery = `
                INSERT INTO "AppointmentHistory"
                (appointment_id, user_id, action, new_status, comment, created_at)
                VALUES ($1, $2, 'created', 'pending', 'Programare creată de client', CURRENT_TIMESTAMP)
            `;

            await client.query(historyQuery, [newAppointment.id, userId]);

            await client.query('COMMIT');

            console.log('Appointment created successfully in database:', newAppointment);
            console.log('Calendar updated - slot current_appointments incremented');

            sendJSON(res, 201, {
                success: true,
                message: 'Programarea a fost creată cu succes',
                appointment: {
                    id: newAppointment.id,
                    date: newAppointment.appointment_date.toISOString().split('T')[0],
                    time: newAppointment.appointment_date.toTimeString().slice(0, 5),
                    status: newAppointment.status,
                    description: newAppointment.problem_description,
                    createdAt: newAppointment.created_at
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error creating appointment:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Eroare la crearea programării'
        });
    }
}

// PUT /api/appointments/:id - Actualizează statusul unei programări și calendarul
async function updateAppointment(req, res, appointmentId, body) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendJSON(res, 401, {
                success: false,
                message: 'Token invalid sau lipsă'
            });
        }

        const { status } = body;

        console.log(`Updating appointment ${appointmentId} with status: ${status} for user ${userId}`);

        // Doar anularea este permisă pentru clienți
        if (status !== 'cancelled') {
            return sendJSON(res, 400, {
                success: false,
                message: 'Poți doar să anulezi programarea'
            });
        }

        // Verifică dacă programarea aparține utilizatorului
        const checkQuery = `
            SELECT id, status, appointment_date
            FROM "Appointments"
            WHERE id = $1 AND user_id = $2
        `;

        const checkResult = await pool.query(checkQuery, [appointmentId, userId]);

        if (checkResult.rows.length === 0) {
            return sendJSON(res, 404, {
                success: false,
                message: 'Programarea nu a fost găsită'
            });
        }

        const appointment = checkResult.rows[0];

        // Verifică dacă programarea poate fi anulată
        if (appointment.status === 'cancelled') {
            return sendJSON(res, 400, {
                success: false,
                message: 'Programarea este deja anulată'
            });
        }

        if (appointment.status === 'completed') {
            return sendJSON(res, 400, {
                success: false,
                message: 'Nu poți anula o programare completată'
            });
        }

        // Verifică regula de 24h (relaxată pentru testare)
        const appointmentDate = new Date(appointment.appointment_date);
        const now = new Date();
        const timeDiff = appointmentDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        if (hoursDiff < 1) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Nu poți anula programarea cu mai puțin de 1 oră înainte'
            });
        }

        // Începe tranzacția pentru a actualiza și Appointments și Calendar
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Actualizează statusul programării
            const updateQuery = `
                UPDATE "Appointments"
                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const updateResult = await client.query(updateQuery, [appointmentId]);

            // Actualizează contorul în calendar (scade cu 1)
            const appointmentDateTime = updateResult.rows[0].appointment_date;
            const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0];
            const appointmentTimeStr = appointmentDateTime.toTimeString().slice(0, 8);

            const updateCalendarQuery = `
                UPDATE "Calendar"
                SET current_appointments = current_appointments - 1
                WHERE date = $1::date 
                AND start_time <= $2::time 
                AND end_time > $2::time
            `;

            await client.query(updateCalendarQuery, [appointmentDateStr, appointmentTimeStr]);

            // Adaugă în istoricul programărilor
            const historyQuery = `
                INSERT INTO "AppointmentHistory"
                (appointment_id, user_id, action, old_status, new_status, comment, created_at)
                VALUES ($1, $2, 'cancelled', $3, 'cancelled', 'Programare anulată de client', CURRENT_TIMESTAMP)
            `;

            await client.query(historyQuery, [appointmentId, userId, appointment.status]);

            await client.query('COMMIT');

            console.log('Appointment cancelled successfully in database');
            console.log('Calendar updated - slot current_appointments decremented');

            sendJSON(res, 200, {
                success: true,
                message: 'Programarea a fost anulată cu succes'
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error updating appointment:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Eroare la actualizarea programării'
        });
    }
}

// GET /api/calendar/available-slots - Folosește tabela Calendar din baza de date
async function getAvailableSlots(req, res, queryParams) {
    try {
        const { date } = queryParams;

        if (!date) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Data este necesară'
            });
        }

        // Verifică dacă data nu e în trecut
        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestedDate < today) {
            return sendJSON(res, 400, {
                success: false,
                message: 'Nu poți face programări în trecut'
            });
        }

        // Verifică dacă e weekend
        const dayOfWeek = requestedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return sendJSON(res, 200, {
                success: true,
                availableSlots: [],
                message: 'Nu lucrăm în weekend'
            });
        }

        // Interrogează tabela Calendar pentru sloturile disponibile
        const query = `
            SELECT
                start_time,
                end_time,
                max_appointments,
                current_appointments,
                (max_appointments - current_appointments) as available_spots
            FROM "Calendar"
            WHERE date = $1
              AND is_available = true
              AND current_appointments < max_appointments
            ORDER BY start_time
        `;

        const result = await pool.query(query, [date]);

        const availableSlots = result.rows.map(row => ({
            startTime: row.start_time,
            endTime: row.end_time,
            availableSpots: row.available_spots,
            maxAppointments: row.max_appointments
        }));

        console.log(`Found ${availableSlots.length} available slots for date ${date}`);

        sendJSON(res, 200, {
            success: true,
            date: date,
            availableSlots: availableSlots
        });

    } catch (error) {
        console.error('Error getting available slots:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Eroare la obținerea sloturilor disponibile'
        });
    }
}

// GET /api/vehicles - Obține vehiculele utilizatorului din baza de date
async function getUserVehicles(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const userId = getUserIdFromToken(authHeader);

        if (!userId) {
            return sendJSON(res, 401, {
                success: false,
                message: 'Token invalid sau lipsă'
            });
        }

        const query = `
            SELECT id, vehicle_type, brand, model, year, is_electric, notes
            FROM "Vehicles"
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [userId]);

        console.log(`Found ${result.rows.length} vehicles for user ${userId}`);

        sendJSON(res, 200, {
            success: true,
            vehicles: result.rows
        });

    } catch (error) {
        console.error('Error getting vehicles:', error);
        sendJSON(res, 500, {
            success: false,
            message: 'Eroare la obținerea vehiculelor'
        });
    }
}

module.exports = {
    getAppointments,
    createAppointment,
    updateAppointment,
    getAvailableSlots,
    getUserVehicles
};