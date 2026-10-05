-- CreateTable
CREATE TABLE "ConfigWifi" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "minutosPorMil" INTEGER NOT NULL DEFAULT 10,
    "minutosMinimo" INTEGER NOT NULL DEFAULT 30,
    "minutosMaximo" INTEGER NOT NULL DEFAULT 180,
    "montoMinimo" INTEGER NOT NULL DEFAULT 2000,
    "dispositivos" INTEGER NOT NULL DEFAULT 1,
    "horasParaActivar" INTEGER NOT NULL DEFAULT 12,
    "redNombre" TEXT NOT NULL DEFAULT '',
    "portalUrl" TEXT NOT NULL DEFAULT '',
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AccesoWifi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "montoBase" INTEGER NOT NULL,
    "minutos" INTEGER NOT NULL,
    "dispositivos" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activableHasta" DATETIME NOT NULL,
    "activadoEn" DATETIME,
    "expiraEn" DATETIME,
    "macs" TEXT NOT NULL DEFAULT '',
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AccesoWifi_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AccesoWifi_codigo_key" ON "AccesoWifi"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "AccesoWifi_ventaId_key" ON "AccesoWifi"("ventaId");

-- CreateIndex
CREATE INDEX "AccesoWifi_creadoEn_idx" ON "AccesoWifi"("creadoEn");

-- Regla inicial (se ajusta desde la pantalla WiFi del POS).
INSERT INTO "ConfigWifi" ("id", "actualizadoEn") VALUES (1, CURRENT_TIMESTAMP);
