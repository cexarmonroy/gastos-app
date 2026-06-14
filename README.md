# 📊 Tesorería Centro de Padres - Gastos App

Una plataforma moderna y eficiente diseñada para la gestión financiera del Centro de Padres y Apoderados (CGPA). Esta aplicación permite centralizar el control de ingresos y egresos, integrándose directamente con Google Sheets para mantener la transparencia y accesibilidad de los datos en tiempo real.

---

## ✨ Características Principales

- **📈 Dashboard Inteligente**: Visualización inmediata de KPIs críticos como Saldo Total, Caja Chica y Fondo de Ahorro con gráficos dinámicos (Recharts).
- **🔄 Sincronización con Google Sheets**: Los datos se leen y escriben directamente en hojas de cálculo de Google, permitiendo una transición fluida entre la app y el flujo de trabajo tradicional.
- **📑 Gestión de Registros**: Módulos especializados para visualizar y filtrar movimientos por fecha, descripción o categoría (Caja Chica / Fondo de Ahorro).
- **🖨️ Reportes PDF**: Generación instantánea de reportes profesionales con logo institucional, listos para ser compartidos con la comunidad.
- **🔐 Seguridad y Roles**: Autenticación robusta mediante NextAuth y Prisma, con control de acceso para administradores y apoderados.
- **📱 Interfaz Premium**: Diseño responsivo y moderno utilizando Tailwind CSS 3.4 y animaciones fluidas.

---

## 🛠️ Stack Tecnológico

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router) + React 19
- **Backend/ORM**: [Prisma](https://www.prisma.io/) con PostgreSQL (Supabase)
- **Estilos**: [Tailwind CSS 3.4](https://tailwindcss.com/)
- **Iconografía**: [Lucide React](https://lucide.dev/)
- **Gráficos**: [Recharts](https://recharts.org/)
- **Autenticación**: [NextAuth.js](https://next-auth.js.org/)
- **Integraciones**: Google APIs Core & Sheets API

---

## 📂 Estructura y Arquitectura

Para un detalle técnico profundo sobre el diseño del sistema, flujos de datos y seguridad, consulta nuestra [Documentación de Arquitectura](architecture.md).

```text
├── app/                  # Rutas de Next.js (Dashboard, Registros, Reportes)
├── components/           # Componentes UI reutilizables y layouts
│   ├── layout/           # Sidebar, Navbar y estructura global
│   └── ui/               # Componentes atómicos (Modales, Tablas, Inputs)
├── lib/                  # Utilidades (PDF, formateo, configuración de clientes)
├── prisma/               # Esquema de base de datos y migraciones
├── public/               # Activos estáticos (Logos, imágenes)
└── scripts/              # Herramientas de extracción y depuración de GIDs
```

---

## 🚀 Configuración Local

### 1. Clonar y Preparar
```bash
git clone <url-del-repo>
cd gastos-app
npm install
```

### 2. Variables de Entorno
Crea un archivo `.env` en la raíz con la siguiente configuración necesaria:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/dbname"

# NextAuth
NEXTAUTH_SECRET="tu_secreto_generado"
NEXTAUTH_URL="http://localhost:3001"
# En Vercel producción usar: NEXTAUTH_URL="https://gastos-app-henna.vercel.app"

# Google Sheets Integration
GOOGLE_SHEET_ID="id_de_tu_hoja_de_calculo"
INSCRIPCIONES_SHEET_ID="id_hoja_inscripciones"
CAJA_CHICA_GID="gid_especifico_hoja"
FONDO_AHORRO_GID="gid_especifico_hoja"

# Google API Service Account
GOOGLE_SERVICE_ACCOUNT_EMAIL="tu_cuenta_de_servicio"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="tu_llave_privada"

# Auth — dominios permitidos para OAuth (separados por coma, opcional)
AUTH_ALLOWED_EMAIL_DOMAINS="gmail.com,escuela.cl"

# Producción: asegúrate de usar HTTPS y NEXTAUTH_URL con https://

# Portal público de transparencia (false = cerrado, requiere login para /portal)
PUBLIC_PORTAL_ENABLED=false

# Dominios permitidos para login con Google (opcional, separados por coma)
AUTH_ALLOWED_EMAIL_DOMAINS="gmail.com,escuela.cl"
```

### 3. Base de Datos e Inicio
```bash
npx prisma db push
npm run dev
```
La aplicación estará disponible en `http://localhost:3001`.

---

## 📝 Notas de Desarrollo

- Se recomienda utilizar el puerto **3001** para evitar conflictos con otros servicios locales comunes.
- El sistema utiliza `jspdf-autotable` para garantizar la consistencia en los reportes exportados.
- Para depurar IDs de hojas de cálculo, utiliza los scripts `get-all-gids.js` o `test-fetch-gids.js`.

---
© 2026 - **Tesorería Centro de Padres** | Impulsando la transparencia financiera.
