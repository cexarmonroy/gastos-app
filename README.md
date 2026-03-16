# Tesorería Centro de Padres - Gastos App

Esta es una aplicación web para la gestión y visualización de finanzas, diseñada específicamente para el Centro de Padres. 

## Características
- **Dashboard en Tiempo Real**: Visualización de KPIs (Saldo Total, Caja Chica, Fondo de Ahorro).
- **Integración con Google Sheets**: Los datos se sincronizan automáticamente desde hojas de cálculo de Google.
- **Gráficos Dinámicos**: Análisis de flujo de ingresos y egresos mediante Recharts.
- **Autenticación Segura**: Gestión de usuarios con NextAuth y Prisma.
- **Generación de Reportes**: Exportación de datos a PDF.

## Tecnologías Utilizadas
- **Framework**: Next.js 16 (App Router)
- **Base de Datos**: PostgreSQL (Supabase) con Prisma ORM
- **Estilos**: Tailwind CSS 4
- **Autenticación**: NextAuth.js

## Configuración Local

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las variables de entorno en un archivo `.env`:
   ```env
   DATABASE_URL="tu_url_de_supabase"
   FONDO_AHORRO_GID="id_de_la_hoja"
   NEXTAUTH_SECRET="un_secreto_aleatorio"
   NEXTAUTH_URL="http://localhost:3000"
   ```
4. Sincroniza la base de datos:
   ```bash
   npx prisma db push
   ```
5. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Despliegue en Vercel

1. Sube el código a un repositorio de GitHub.
2. Conecta el repositorio a un nuevo proyecto en Vercel.
3. Asegúrate de configurar todas las variables de entorno listadas arriba en el dashboard de Vercel.
4. Vercel ejecutará automáticamente el build y el despliegue.

---
© 2026 - Tesorería Centro de Padres
