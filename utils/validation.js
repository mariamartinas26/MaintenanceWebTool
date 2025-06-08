/**
 * Validează format email
 * @param {string} email - Email de validat
 * @returns {boolean} - True dacă email-ul este valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validează format dată (YYYY-MM-DD)
 * @param {string} date - Data de validat
 * @returns {boolean} - True dacă data este validă
 */
function isValidDate(date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;

    const dateObj = new Date(date);
    return dateObj instanceof Date && !isNaN(dateObj);
}

/**
 * Validează format timp (HH:MM)
 * @param {string} time - Timpul de validat
 * @returns {boolean} - True dacă timpul este valid
 */
function isValidTime(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}

/**
 * Validează anul
 * @param {number} year - Anul de validat
 * @returns {boolean} - True dacă anul este valid
 */
function isValidYear(year) {
    const currentYear = new Date().getFullYear();
    return year >= 1900 && year <= currentYear + 1;
}

/**
 * Validează lungimea string-ului
 * @param {string} str - String-ul de validat
 * @param {number} minLength - Lungimea minimă
 * @param {number} maxLength - Lungimea maximă
 * @returns {boolean} - True dacă lungimea este validă
 */
function isValidStringLength(str, minLength = 0, maxLength = Infinity) {
    if (typeof str !== 'string') return false;
    return str.length >= minLength && str.length <= maxLength;
}

/**
 * Validează tipul vehiculului
 * @param {string} vehicleType - Tipul vehiculului
 * @returns {boolean} - True dacă tipul este valid
 */
function isValidVehicleType(vehicleType) {
    const validTypes = ['motocicleta', 'bicicleta', 'trotineta'];
    return validTypes.includes(vehicleType);
}

/**
 * Validează statusul programării
 * @param {string} status - Statusul de validat
 * @returns {boolean} - True dacă statusul este valid
 */
function isValidAppointmentStatus(status) {
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'];
    return validStatuses.includes(status);
}

/**
 * Sanitizează input string (elimină caractere periculoase)
 * @param {string} input - Input-ul de sanitizat
 * @returns {string} - Input-ul sanitizat
 */
function sanitizeString(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>\"'&]/g, '');
}

/**
 * Validează că data nu este în trecut
 * @param {string} date - Data de validat
 * @returns {boolean} - True dacă data este în viitor
 */
function isFutureDate(date) {
    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate >= today;
}

/**
 * Validează că datetime-ul nu este în trecut
 * @param {string} date - Data
 * @param {string} time - Timpul
 * @returns {boolean} - True dacă datetime-ul este în viitor
 */
function isFutureDateTime(date, time) {
    const dateTime = new Date(`${date}T${time}:00`);
    const now = new Date();
    return dateTime > now;
}

/**
 * Verifică dacă o zi este weekend
 * @param {string} date - Data de verificat
 * @returns {boolean} - True dacă este weekend
 */
function isWeekend(date) {
    const dayOfWeek = new Date(date).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Validează ID numeric
 * @param {any} id - ID-ul de validat
 * @returns {boolean} - True dacă ID-ul este valid
 */
function isValidId(id) {
    const numId = parseInt(id);
    return !isNaN(numId) && numId > 0;
}

/**
 * Validează boolean
 * @param {any} value - Valoarea de validat
 * @returns {boolean} - True dacă valoarea este boolean valid
 */
function isValidBoolean(value) {
    return typeof value === 'boolean' || value === 'true' || value === 'false' || value === true || value === false;
}

/**
 * Convertește string la boolean
 * @param {any} value - Valoarea de convertit
 * @returns {boolean} - Valoarea convertită
 */
function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
}

module.exports = {
    isValidEmail,
    isValidDate,
    isValidTime,
    isValidYear,
    isValidStringLength,
    isValidVehicleType,
    isValidAppointmentStatus,
    sanitizeString,
    isFutureDate,
    isFutureDateTime,
    isWeekend,
    isValidId,
    isValidBoolean,
    toBoolean
};