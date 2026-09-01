# Runbook — MikroTik RB5009-NUCLEO-L1 (migración desde ARRIS)

> Documento de continuidad. La sesión remota anterior se cortó (el servidor
> `192.168.0.179` se quedó sin internet) justo antes de configurar DNS.
> Este archivo guarda el estado y los pasos pendientes para poder retomar
> desde cualquier equipo.

## 1. Estado conocido (verificado en consola)

| Dato | Valor |
|---|---|
| Router | RB5009, identity `RB5009-NUCLEO-L1` |
| LAN | `192.168.0.0/24` |
| Gateway LAN | `192.168.0.1` (antes ARRIS, ahora el RB5009 con la misma IP) |
| Servidor | `192.168.0.179` (Windows, responde ping 5/5, 0% loss) |
| DHCP server | `dhcp-lan`, activo |
| Lease bound | `192.168.0.250` — `F8:E4:3B:26:B3:7B` — `Laptop-Hp-P-Lac` |
| Cajas (POS) | Con comunicación hacia `192.168.0.1` y `192.168.0.179` |

**Conclusión:** capa 2 y capa 3 de la LAN están OK. Lo que falta es salida a
internet y/o resolución de nombres.

### Nota heredada de la migración
Los equipos que tenían al ARRIS en caché ARP pueden no responder unos minutos.
Se corrige solo, o en el equipo Windows como administrador:

```cmd
arp -d *
ipconfig /flushdns
```

## 2. Antes de tocar nada: red de seguridad

Se perdió una sesión ya; que no se pierda la configuración.

```rsc
/system backup save name=rb5009-pre-dns
/export file=rb5009-pre-dns
```

Y para cada cambio que pueda cortar el acceso, usar **Safe Mode**
(`Ctrl+X` en terminal, o el botón *Safe Mode* en Winbox): si se cae la sesión,
RouterOS revierte los cambios automáticamente.

Acceso de respaldo si se pierde la IP: **Winbox conectando por MAC address**
(pestaña *Neighbors*), que no depende de IP ni de ruteo.

## 3. Diagnóstico (ejecutar y guardar la salida)

```rsc
/interface print brief
/ip address print
/ip route print where dst-address=0.0.0.0/0
/ip dhcp-client print
/interface pppoe-client print
/interface list member print
/ip firewall nat print
/ip dns print
/ip dhcp-server network print detail
/ping 8.8.8.8 count=4
/ping google.com count=4
```

### Cómo leer el resultado

| `ping 8.8.8.8` | `ping google.com` | Diagnóstico |
|---|---|---|
| OK | OK | El router sale bien → el problema es del cliente (ver §6) |
| OK | falla | **Falta DNS en el router** → §4 |
| falla | falla | Falta ruta por defecto / WAN caída / falta NAT → §5 |

El mismo test desde el servidor `192.168.0.179` (CMD): `ping 8.8.8.8` contra
`ping google.com`. Si la IP responde y el nombre no, es DNS puro.

## 4. Paso pendiente: DNS (era el siguiente en la sesión cortada)

```rsc
/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes
/ip dns cache flush
/ip dns print
```

Repartir el DNS a la LAN por DHCP (el router como resolver):

```rsc
/ip dhcp-server network print detail
/ip dhcp-server network set [find address=192.168.0.0/24] \
    gateway=192.168.0.1 dns-server=192.168.0.1
```

### ⚠️ Seguridad — obligatorio con `allow-remote-requests=yes`

Con esa opción el router resuelve para quien se lo pida. Si el puerto 53
queda expuesto a la WAN, queda como **open resolver** (abuso por
amplificación DNS). Verificar que la cadena `input` no acepte 53 desde la WAN:

```rsc
/ip firewall filter print
```

Si el firewall por defecto no está (cadena `input` permisiva), agregar arriba:

```rsc
/ip firewall filter
add chain=input action=drop protocol=udp dst-port=53 in-interface-list=WAN \
    comment="drop DNS desde WAN (anti open-resolver)"
add chain=input action=drop protocol=tcp dst-port=53 in-interface-list=WAN \
    comment="drop DNS desde WAN (anti open-resolver)"
# y subirlas por encima de cualquier accept de la cadena input:
/ip firewall filter move [find comment~"anti open-resolver"] destination=0
```

## 5. Si tampoco hay salida por IP (ping 8.8.8.8 falla desde el router)

Revisar en este orden:

1. **WAN arriba**: `/ip dhcp-client print` (si el ARRIS entrega IP) o
   `/interface pppoe-client print` (si es PPPoE del ISP).
2. **Ruta por defecto**: `/ip route print where dst-address=0.0.0.0/0`
   debe existir y estar `A S` (activa).
3. **Interface list WAN poblada** (la usan NAT y firewall):

   ```rsc
   /interface list print
   /interface list member print
   # si falta:
   /interface list add name=WAN
   /interface list member add list=WAN interface=<ether-de-la-WAN>
   ```

4. **NAT masquerade**:

   ```rsc
   /ip firewall nat print where action=masquerade
   # si no existe:
   /ip firewall nat add chain=srcnat out-interface-list=WAN action=masquerade \
       comment="NAT LAN->WAN"
   ```

5. **ARRIS**: definir si quedó en *bridge* (el RB5009 toma la IP pública) o en
   modo router (doble NAT). En modo router, el RB5009 debe tener como gateway
   la IP LAN del ARRIS y ese ARRIS no puede seguir en `192.168.0.0/24`, porque
   choca con la LAN nueva.

## 6. Arreglar el servidor `192.168.0.179`

Tiene IP fija (está fuera del pool y no aparece como lease). Verificar en
Windows que quedó apuntando al MikroTik y no a datos viejos del ARRIS:

```cmd
ipconfig /all
```

Debe mostrar: `Default Gateway 192.168.0.1` y `DNS Servers 192.168.0.1`
(secundario `1.1.1.1` si se quiere respaldo). Tras corregir:

```cmd
arp -d *
ipconfig /flushdns
nslookup google.com
```

## 7. Verificación final

- Desde el router: `/ping google.com count=4` → 0% loss.
- Desde el servidor `.179`: `nslookup google.com` responde desde `192.168.0.1`.
- Desde una caja: navegación y acceso al servidor `.179` (POS) funcionando.
- Desde el laptop `192.168.0.250`: `ipconfig /release` + `/renew` y confirmar
  que recibe `dns-server=192.168.0.1`.

Cuando todo esté verde, volver a exportar la configuración buena:

```rsc
/export file=rb5009-post-dns
/system backup save name=rb5009-post-dns-ok
```

## 8. Pendientes / decisiones abiertas

- [ ] Confirmar modo del ARRIS (bridge vs router) y anotarlo aquí.
- [ ] Reserva DHCP fija para las cajas (`make-static` sobre el lease) para que
      nunca cambien de IP.
- [ ] Definir si el servidor `.179` debe tener DNS estático `192.168.0.1` o
      pasar a reserva DHCP.
- [ ] Documentar la lista de MAC/IP de cada caja.
