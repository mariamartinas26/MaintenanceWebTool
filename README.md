<div align="center">

  <img src="assets/logo.png" alt="logo" width="200" height="auto" />
  <h1>Maintenance Web Tool - Repair Queens</h1>

  <p>
    Web system for managing appointments and operations in auto service centers
  </p>

<!-- Badges -->
<p>
  <a href="https://github.com/YOUR_USERNAME/maintenance-web-tool/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/YOUR_USERNAME/maintenance-web-tool" alt="contributors" />
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/YOUR_USERNAME/maintenance-web-tool" alt="last update" />
  </a>
  <a href="https://github.com/YOUR_USERNAME/maintenance-web-tool/network/members">
    <img src="https://img.shields.io/github/forks/YOUR_USERNAME/maintenance-web-tool" alt="forks" />
  </a>
  <a href="https://github.com/YOUR_USERNAME/maintenance-web-tool/stargazers">
    <img src="https://img.shields.io/github/stars/YOUR_USERNAME/maintenance-web-tool" alt="stars" />
  </a>
  <a href="https://github.com/YOUR_USERNAME/maintenance-web-tool/issues/">
    <img src="https://img.shields.io/github/issues/YOUR_USERNAME/maintenance-web-tool" alt="open issues" />
  </a>
  <a href="https://github.com/YOUR_USERNAME/maintenance-web-tool/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/YOUR_USERNAME/maintenance-web-tool.svg" alt="license" />
  </a>
</p>

<h4>
    <a href="https://your-demo-link.com">View Demo</a>
  <span> · </span>
    <a href="documentatie/documentatie.html">Documentation</a>
  <span> · </span>
    <a href="https://github.com/YOUR_USERNAME/maintenance-web-tool/issues/">Report Bug</a>
  <span> · </span>
    <a href="https://github.com/YOUR_USERNAME/maintenance-web-tool/issues/">Request Feature</a>
  </h4>
</div>

<br />

<!-- Table of Contents -->
# Table of Contents

- [About the Project](#about-the-project)
    * [Tech Stack](#tech-stack)
    * [Features](#features)
    * [User Roles](#user-roles)
    * [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
    * [Prerequisites](#prerequisites)
    * [Installation](#installation)
    * [Run Locally](#run-locally)
- [Usage](#usage)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgements](#acknowledgements)

<!-- About the Project -->
## About the Project

Maintenance Web Tool is a web application designed for efficient management of appointments and operations carried out in a service center for motorcycles, bicycles, and scooters. The platform offers personalized functionalities for clients, administrators, managers, and accountants.

### Tech Stack

<details>
  <summary>Frontend</summary>
  <ul>
    <li><a href="https://developer.mozilla.org/en-US/docs/Web/HTML">HTML5</a></li>
    <li><a href="https://developer.mozilla.org/en-US/docs/Web/CSS">CSS3</a></li>
    <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript">JavaScript (Vanilla)</a></li>
  </ul>
</details>

<details>
  <summary>Backend</summary>
  <ul>
    <li><a href="https://nodejs.org/">Node.js (Vanilla)</a></li>
    <li><a href="https://www.npmjs.com/package/jsonwebtoken">JSON Web Tokens (JWT)</a></li>
    <li><a href="https://www.npmjs.com/package/bcrypt">bcrypt</a></li>
  </ul>
</details>

<details>
<summary>Database</summary>
  <ul>
    <li><a href="https://www.postgresql.org/">PostgreSQL</a></li>
    <li><a href="https://www.npmjs.com/package/pg">node-postgres (pg)</a></li>
  </ul>
</details>

### Features

- Secure authentication with JWT and bcrypt encryption
- Personalized dashboards for each user type
- Appointment management with approval/rejection workflow
- Parts inventory with order tracking and status management
- Import/Export functionality in CSV, JSON, and PDF formats
- Email notification system
- Input validation and sanitization for security
- Responsive design for all devices

### User Roles

- **Client**: Creates appointments, manages vehicles, tracks service status
- **Administrator**: Approves appointments, manages inventory, sets prices and warranties
- **Manager**: Approves new accounts, assigns user roles
- **Accountant**: Manages suppliers, handles data import/export, generates financial reports

### Environment Variables

To run this project, you will need to add the following environment variables to your `.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=maintenance_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Server
PORT=8083
NODE_ENV=development
```

## Getting Started

### Prerequisites

This project requires Node.js and PostgreSQL to be installed on your system:

```bash
# Check Node.js version (minimum v14)
node --version

# Check npm version
npm --version

# Check PostgreSQL
psql --version
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/maintenance-web-tool.git
cd maintenance-web-tool
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Connect to PostgreSQL and create database
psql -U postgres
CREATE DATABASE maintenance_db;
```

4. Run initialization scripts:
```bash
psql -U postgres -d maintenance_db -f database/schema.sql
psql -U postgres -d maintenance_db -f database/seed.sql
```

### Run Locally

1. Start the server:
```bash
node app.js
```

2. Access the application:
```
http://localhost:8083
```

## Usage

### For Clients:
1. **Registration**: Create a new account (requires manager approval)
2. **Add vehicles**: Register motorcycles, bicycles, or scooters
3. **Schedule services**: Select date, time, and describe the problem
4. **Track progress**: View appointment status and updates

### For Administrators:
1. **Manage appointments**: Approve/reject requests with price estimates
2. **Inventory management**: Monitor parts stock and orders
3. **Reports**: Generate analytics about service center activity

## Database Schema

The application uses the following main tables:

- `users` - User information and authentication
- `vehicles` - Vehicles registered by clients
- `appointments` - Appointments and their statuses
- `appointment_history` - History of appointment changes
- `inventory` - Parts and components stock
- `suppliers` - Suppliers and contact information
- `orders` - Parts orders to suppliers

## API Documentation

### Main endpoints:

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User authentication

**Appointments:**
- `GET /api/appointments` - List user appointments
- `POST /api/appointments` - Create new appointment
- `PUT /api/appointments/:id` - Update appointment

**Manager:**
- `GET /api/manager/requests` - New account requests
- `POST /api/manager/requests/:id/approve` - Approve account

For complete documentation, see [API Documentation](docs/api.md)

## Roadmap

- [x] Authentication and authorization system
- [x] Dashboards for all user roles
- [x] Appointment and vehicle management
- [x] Inventory and parts ordering
- [ ] Push notification system
- [ ] Payment service integration
- [ ] Mobile application (React Native)
- [ ] Advanced reporting with charts
- [ ] API for external integrations

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details about the contribution process.

### Code of Conduct

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## Contact

**Martinas Ioana Maria** - martinas.mariaioana@gmail.com

**Sacarescu Rebecca Maria** - rebeccasacarescu@yahoo.com

**Project Link**: [https://github.com/YOUR_USERNAME/maintenance-web-tool](https://github.com/YOUR_USERNAME/maintenance-web-tool)

**Documentation**: [Scholarly HTML Documentation](documentatie/documentatie.html)

## Acknowledgements

- [Node.js Documentation](https://nodejs.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT.io](https://jwt.io/)
- [bcrypt](https://www.npmjs.com/package/bcrypt)
- [Shields.io](https://shields.io/) for badges
- [Scholarly HTML](https://w3c.github.io/scholarly-html/) for documentation