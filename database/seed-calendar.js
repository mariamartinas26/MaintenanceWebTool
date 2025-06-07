const { pool } = require('./server'); // Ajustează calea în funcție de structura proiectului

// Funcția originală pentru adăugarea de date pentru 15 mai
async function seedCalendar() {
    try {
        const query = `
      INSERT INTO "Calendar" 
      ("date", "start_time", "end_time", "is_available", "max_appointments", "current_appointments", "notes")
      VALUES 
      ('2025-05-15', '09:00:00', '11:00:00', true, 3, 0, 'Interval de dimineață'),
      ('2025-05-15', '11:00:00', '13:00:00', true, 3, 0, 'Interval de prânz'),
      ('2025-05-15', '14:00:00', '16:00:00', true, 3, 0, 'Interval de după-amiază'),
      ('2025-05-15', '16:00:00', '18:00:00', true, 3, 0, 'Interval de seară');
    `;

        await pool.query(query);
        console.log('Calendar data for May 15th inserted successfully!');
    } catch (error) {
        console.error('Error seeding calendar data for May 15th:', error);
    }
}

async function seedCalendarJune() {
    try {
        // Start with an array to hold all our insert values
        const insertValues = [];

        // June 2025 has 30 days
        for (let day = 1; day <= 30; day++) {
            // Format the day with leading zero if needed
            const formattedDay = day.toString().padStart(2, '0');
            const date = `2025-06-${formattedDay}`;

            // Check if the day is a weekend (Saturday or Sunday)
            const dayOfWeek = new Date(`2025-06-${formattedDay}`).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0 is Sunday, 6 is Saturday

            // Only add time slots for weekdays
            if (!isWeekend) {
                insertValues.push(
                    `('${date}', '09:00:00', '11:00:00', true, 3, 0, 'Interval de dimineață')`,
                    `('${date}', '11:00:00', '13:00:00', true, 3, 0, 'Interval de prânz')`,
                    `('${date}', '14:00:00', '16:00:00', true, 3, 0, 'Interval de după-amiază')`,
                    `('${date}', '16:00:00', '18:00:00', true, 3, 0, 'Interval de seară')`
                );
            }
        }

        // Create the SQL query with all values
        const query = `
      INSERT INTO "Calendar" 
      ("date", "start_time", "end_time", "is_available", "max_appointments", "current_appointments", "notes")
      VALUES
      ${insertValues.join(',\n')};
    `;

        await pool.query(query);
        console.log('Calendar data for June 2025 weekdays inserted successfully!');
    } catch (error) {
        console.error('Error seeding calendar data for June 2025:', error);
    }
}

// Noua funcție pentru adăugarea de date pentru toată luna mai 2025
async function seedCalendarForMay2025() {
    try {
        // Array cu intervalele orare standard pentru fiecare zi
        const timeSlots = [
            { start: '09:00:00', end: '11:00:00', notes: 'Interval de dimineață' },
            { start: '11:00:00', end: '13:00:00', notes: 'Interval de prânz' },
            { start: '14:00:00', end: '16:00:00', notes: 'Interval de după-amiază' },
            { start: '16:00:00', end: '18:00:00', notes: 'Interval de seară' }
        ];

        // Generăm valori pentru fiecare zi din mai 2025 (1-31)
        let valuesList = [];

        for (let day = 1; day <= 31; day++) {
            // Formatăm ziua cu zero în față dacă e nevoie
            const formattedDay = day.toString().padStart(2, '0');
            const date = `2025-05-${formattedDay}`;

            // Pentru fiecare zi, adăugăm toate intervalele orare
            timeSlots.forEach(slot => {
                valuesList.push(`('${date}', '${slot.start}', '${slot.end}', true, 3, 0, '${slot.notes}')`);
            });
        }

        // Construim query-ul cu toate valorile
        const query = `
      INSERT INTO "Calendar" 
      ("date", "start_time", "end_time", "is_available", "max_appointments", "current_appointments", "notes")
      VALUES 
      ${valuesList.join(',\n      ')};
    `;

        await pool.query(query);
        console.log('Calendar data for all of May 2025 inserted successfully!');
    } catch (error) {
        console.error('Error seeding calendar data for all of May 2025:', error);
    }
}
async function seedVehicles() {
    try {
        const query = `
      INSERT INTO "Vehicles" 
      ("user_id", "vehicle_type", "brand", "model", "year", "is_electric", "notes")
      VALUES 
      (4, 'motocicleta', 'Honda', 'CBR600', 2023, false, 'Motocicletă sport'),
      (4, 'bicicleta', 'Trek', 'Domane', 2024, false, 'Bicicletă de șosea'),
      (4, 'trotineta', 'Xiaomi', 'Pro 2', 2022, true, 'Trotinetă electrică');
    `;

        await pool.query(query);
        console.log('Vehicle data inserted successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding vehicle data:', error);
        process.exit(1);
    }
}
// Funcție principală care rulează ambele funcții sau doar cea nouă
async function main() {
    try {
        // Poți comenta această linie dacă dorești să nu mai adaugi datele pentru 15 mai
        // await seedCalendar();
        //await seedCalendarJune();
        // Adaugă date pentru întreaga lună
        //await seedVehicles();
        //await seedCalendarForMay2025();

        console.log('All calendar data inserted successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

// Pornește execuția
main();