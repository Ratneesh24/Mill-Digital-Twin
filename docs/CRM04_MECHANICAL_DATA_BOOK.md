# CRM04 — 4-Hi Reversing Cold Rolling Mill
## Mechanical Technical Data Book

**Plant:** Tata Steel CRM Sahibabad — Narrow Complex
**Machine:** CRM04, 4-Hi Reversing Cold Rolling Mill
**OEM:** Flat Products Equipments (I) Ltd. (FPE)
**Source:** FPE Operation & Maintenance Manual, 231 pp., 13 chapters + vendor catalogues. Drawing series `EU xx x A1`, part series `FPE xxx-x-xxxx` / `CV xx x xx`.
**Units:** mm unless stated.

> **Why this file is in the repo.** `src/config/millConfig.ts` cites it by section
> for every value badged `Confirmed — FPE O&M manual`, and `ASSUMPTIONS.md` cites
> its §14 for everything still badged UNVERIFIED. Without the source in-tree those
> citations cannot be checked.

---

# 1. MACHINE MASTER SPECIFICATION

## 1.1 Process envelope

| Parameter | Value |
|---|---|
| Type of mill | 4-Hi Reversing Cold Rolling Mill |
| Material rolled | Low, medium and high carbon steel — 0.05 % to 1.03 % C |
| Mill hand | **Right to Left** |
| Mill speed | 0 – 170 – 450 mpm |
| Roll separating force | **360 T max** |

## 1.2 Coil data

| | Incoming | Outgoing |
|---|---|---|
| Width | 500 max / 250 min | — |
| Thickness | 1.6 – 4.5 mm | 0.30 – 3.00 mm |
| Coil type | Tight square wound | — |
| Coil ID | 508 | 508 |
| Coil OD | *see §14 item 4* | 1900 max |
| Coil weight | 10 T (20 kg/mm max) | 10 T (20 kg/mm max) |

## 1.3 Rolls

| | Work roll | Back-up roll |
|---|---|---|
| Working Ø max | 215 | 550 |
| Working Ø min | 202 | 520 |
| Barrel length | 600 | 600 |
| Construction | Special forged steel, hardened | Special forged steel, hardened |
| Barrel hardness | 92 – 97 Shore C | 65 – 70 Shore C |
| Neck hardness | 40 – 45 Shore C | 45 – 50 Shore C |
| Neck bearing | Timken TQO 4-row TRB | Timken TQO 4-row TRB |
| Bearing lubrication | Grease packed | Grease packed |
| Roll make | Union Electric, USA — FPE236-1-160 | Union Electric, USA — FPE236-1-130 |
| Drawing | EU 17 1 A1 | EU 16 1 A1 |

## 1.4 Load and tension

| Parameter | Value |
|---|---|
| Roll force cylinder | Ø420 ram × **45 mm stroke** (Table I: Ø420 × Ø380 × 45) |
| Roll force cyl working / test pressure | 210 / 250 kg/cm² |
| All other hyd cylinders working / test pressure | 105 / 160 kg/cm² |
| Pay-off reel tension | 2500 kg max up to 170 mpm |
| Tension reel tension | 6900 kg max up to 350 mpm |
| | 5300 kg max up to 450 mpm |
| | 690 kg **minimum** up to 450 mpm |
| Pay-off reel axial shift | ± 75 mm (75 mm either side of C/L) |

---

# 2. DRIVE REGISTER

## 2.1 DC drives

| Drive | Rating | Speed range | Make / frame |
|---|---|---|---|
| Main mill | 750 kW | 0 – 350 – 710 rpm | Kirloskar KLDC 630-L |
| Entry tension reel | 500 kW | 0 – 438 – 1350 rpm | BSSL |
| Delivery tension reel | 500 kW | 0 – 438 – 1350 rpm | BSSL |
| Pay-off reel | 70 kW | 0 – 435 – 1640 rpm | BSSL |

## 2.2 AC drives

| Service | kW | Qty |
|---|---|---|
| Pinch roll cum flattener | 11.0 | 1 |
| LP hydraulic system | 30.0 | 1 + 1 |
| LP hydraulic circulating | 2.2 | 1 |
| HP hydraulic — bending / balancing | 22.0 | 1 + 1 |
| HP hydraulic — roll loading | 22.0 | 1 + 1 |
| HP hydraulic circulating | 2.2 | 1 |
| Drive lubrication (ETR, DTR & mill) | 5.5 | 1 + 1 |
| Drive lubrication — POR | 1.1 | 1 |
| Fume exhaust blower | 37.5 | 1 |
| Coolant supply pump | 30.0 | 1 + 1 |
| Magnetic separator | 0.37 | 1 |
| Skimmer device | 0.18 | 1 |
| Self-cleaning filter | 0.18 | 1 |
| Drive lube system heaters | 3.0 | 2 |
| DC motor cooling fan — ETR | 15.0 | 1 |
| DC motor cooling fan — Mill | 15.0 | 1 |
| DC motor cooling fan — DTR | 15.0 | 1 |
| DC motor cooling fan — POR | 15.0 | 1 |

## 2.3 Gear ratios

| Unit | Ratio | Type |
|---|---|---|
| Pay-off reel gearbox | **99.37 : 1** | Helical, totally enclosed, cast steel gears + alloy steel pinion |
| ETR / DTR gearbox | **4.3333 : 1** | — |
| Mill pinion stand | **1 : 1** | FLENDER SPL 260-2 |
| Flattener reducer | **20 : 1** | Splash lubricated |

---

# 3. LINE LAYOUT

Centre-line order along the pass line (GA drawings EU 01 1 A1 elevation / EU 01 0 A1 plan):

```
POR → C/L PINCH ROLL → C/L ETR → C/L ENTRY DEFLECTOR → C/L MILL → C/L DELIVERY DEFLECTOR → C/L DTR
```

**Consequence:** the pay-off reel and pinch-roll/flattener sit **outboard of the entry tension reel**. On the first pass the strip runs POR → peeler → flattener → carry-over table → *over an idle ETR* → entry deflector roll → mill → delivery deflector roll → DTR. From pass 2 the ETR becomes the coiler.

Civil references: EU 50 1 A1 foundation layout, EU 50 2 A1 cellar layout, EU 50 3 A1 trench layout. POR and all three coil cars are **pit mounted**.

Centre-line spacings are dimensioned on EU 01 1 A1 but are not legible in the scanned manual — see §14 item 1.

---

# 4. EQUIPMENT REGISTER (Chapter 2)

| # | Equipment | Qty |
|---|---|---|
| 1 | Coil storage saddles at pay-off reel with coil car | 1 |
| 2 | Pay-off reel with snubber roll | 1 |
| 3 | Peeler unit | 1 |
| 4 | Pinch roll cum flattener unit | 1 |
| 5 | Carry-over table | 1 |
| 6 | Deflector roll (entry & delivery) | 1 each |
| 7 | Crop shear (delivery) | 1 |
| 8 | Thickness measuring gauges (entry & delivery) | 1 each |
| 9 | Air knife wiper assembly (entry & delivery) | 1 each |
| 10 | 4-Hi reversing mill stand — rolls, drive, roll changing, strip sprays, spindle, Mae-west, hydraulic roll force cylinders, pressure board & side guide, threading tables (entry & delivery), roll change system | 1 set |
| 11 | Tension reel with coil stripper (entry & delivery) | 1 each |
| 12 | Coil car with exit storage saddles at each tension reel | 1 each |

**Electricals:** DC motors (BSSL), DC & AC drive controls and automation, **Automatic Gauge Control system** (1), **Mill Management System with printer** (1).

---

# 5. EQUIPMENT MECHANICAL DETAILS (Chapter 5)

## 5.1 Coil storage saddles and coil car at pay-off reel
*Drawings: EU 02 0 A1 (coil ramp/saddle), EU 02 1 A1 (coil car)*

**Entry coil storage saddle**

| Item | Value |
|---|---|
| Construction | Welded steel, hard nylon facings on supporting faces |
| Type | Vee platten with hard nylon facing |
| Capacity | 2 full-width coils |
| Handling capacity | 10 T |
| Max coil Ø | 1900 |

**Entry coil car** (identical units at POR, ETR, DTR)

| Item | Value |
|---|---|
| Type | Pit mounted |
| Travel length | 3400 |
| Traverse speed | 150 mm/s max |
| Lift speed | 75 mm/s max |
| Elevator | Welded steel frame, Vee platten nylon top; connected to hydraulic cylinder through **brass lined guides** |
| Elevator cylinder | Ø160 × Ø90 × 800 stroke (FPE414-3-1233/R0), mounted on carriage frame |
| Carriage | Welded steel, on wheels with antifriction bearings |
| Traverse drive | Hydraulic motor, **Danfoss OMP-315** |
| Hose management | Drag chain |
| Tracks | Foundation-mounted steel tracks |
| Pit covers | Welded steel telescopic plates attached to carriage front end, sliding on welded steel track on **cam followers** |
| Wheel bearing | Spherical roller Ø80 × Ø140 × 33, 22216CC, SKF/FAG — 12 nos |

## 5.2 Pay-off reel with snubber roll
*Drawings: EU 03 0 A1 (GA), EU 03 1 A1 (gearbox), EU 03 2 A1 (mandrel), EU 03 3 A1 (snubber)*

**Reel**

| Item | Value |
|---|---|
| Type | 4-segment expanding/collapsing **overhung** mandrel |
| Barrel length | 680 |
| Collapsed Ø | 460 |
| Expanded Ø | 530 |
| True circle Ø | 508 |
| Motor | 70 kW, 0-435-1640 rpm |
| Base | Welded steel gearbox sub-base with legs, sliding axially in guideways on both sides by hydraulic cylinder |
| Axial shift cylinder | Ø160 × Ø90 × 150 (CV 03 0 D1/R0) — ±75 mm, operated manually |

**Mandrel (EU 03 2 A1)**
- Two **pyramids** + **four segments**.
- Mandrel shaft: heat-treated steel on antifriction bearings.
- Pyramids: cast steel fitted with **bronze liners**. Segments: cast steel.
- Connected by a **central pull rod** to a **rotating hydraulic cylinder** through a **rotary union** for expansion/collapse.
- Rotating cylinder: **Ø250 × Ø110 × 130 stroke** (CV 03 2 D1/R0).

**Gearbox (EU 03 1 A1)**
- Ratio 99.37:1, helical, totally enclosed.
- Cast steel gears, alloy steel pinion, antifriction bearings.
- **DC brake between motor and gearbox input shaft** (Bhartia Cutler-Hammer).
- Bearings: 23124CC/W33 Ø170×Ø200×62 (2), 23128CC/W33 Ø140×Ø225×68 (2), 23044CC/W33 Ø230×Ø340×90 (1), 23052CC/W33 Ø260×Ø400×104 (1) — SKF/FAG.

**Snubber (EU 03 3 A1)**

| Item | Value |
|---|---|
| Snubber arm | Mounted on POR gearbox casing, hydraulically operated |
| Arm cylinder | Ø80 × Ø45 × 300 (CV 03 3 C1/R0) |
| Snubber roll | Hollow steel Ø200 × 200 long, **neoprene rubber covering** |
| Roll drive | Hydraulic motor **Danfoss OMP-315** through flexible coupling |
| Bearing | Flange cartridge MFC-40, RHP make (2) |
| Sliding base | Carries snubber + gearbox + motor + brake; moves axially on fixed base fitted with liners on both sides; guide way on one side has **screw adjustment for clearance**; legs guided from side and top to prevent toppling |

## 5.3 Peeler unit / coil opener
*Drawing: EU 05 1 A1*

- Peeler table mounted on the flattener unit frame.
- Raised/lowered and forwarded/retracted by hydraulic cylinders.
- **Replaceable steel knife** at the front.
- Cylinders: Ø50 × Ø28 × 580 (FPE408-3-214/R0) and Ø80 × Ø45 × 195 (FPE408-3-215/R0).
- Function: knife enters under the coil end to cut bands; table then supports the strip front edge up to the pinch roll cum flattener during threading; swung back and retracted after threading.
- Knife edge sharpness to be checked once or twice a year.

## 5.4 Pinch roll cum flattener unit
*Drawings: EU 06 0 A1 (GA), EU 06 1 A1 (assembly), EU 06 2 A1 (5T jactuator), EU 06 3 A1 (pinion stand), EU 06 4 A1 (coupler shifting), EU 06 5 A1 (carry-over table)*

| Item | Value |
|---|---|
| Pinch rolls | 2 nos, **Ø250 × 600 barrel** |
| Leveller rolls | 3 nos, **Ø200 × 600 barrel** |
| Roll material | Hardened steel on antifriction bearings |
| Housing | Fabricated steel, foundation mounted |
| Top pinch roll | Hydraulically raised/lowered |
| Top flattening roll | Hydraulic coarse penetration set + **hand-wheel screw jack (5T jactuator)** fine adjust |
| Bottom rolls | Fixed in position |
| Drive train | 11 kW AC motor → reducer 20:1 → **hydraulically engaging/disengaging gear coupler** → **multi-output-shaft pinion stand** → propeller shafts to each roll |
| Threading speed | ≈ 30 m/min |
| Coupling type | Geared coupling |
| Reducer lubrication | Splash type |
| Pinion stand lubrication | Forced type |
| Roll lift cylinders | Ø100 × Ø70 × 80 (FPE236-3-663/R0) — 4 nos |
| Coupler shifting cylinder | Ø50 × Ø36 × 60 (FPE236-3-690/R0) |
| Roll bearings | Spherical roller Ø100 × Ø165 × 52, 23120CC/W33, SKF — 10 nos |
| Pinion stand bearings | 22216CC/W33 Ø80×Ø140×33 (10), 22218CC/W33 Ø90×Ø160×33 (2) |
| Coupler cam followers | NUKD-35, SKF/FAG (2) |
| Jactuator bearings | Thrust ball 51210 Ø50×Ø78×22 (4); taper roller 30204 Ø20×Ø47×15.25 (4) |

**Side guide (EU 05 3 A1)** — mounted on the flattener unit frame. Steel rolls in brackets; brackets move toward and away from centre **simultaneously** by screw & nut mechanism, hand-wheel operated. Bearings: deep groove 6206-2Z Ø30×Ø62×16 (2). Maintains strip centre during initial threading from POR to delivery tension reel.

## 5.5 Carry-over table
*Drawing: EU 06 5 A1*

Welded steel bed at the exit end of the flattener unit. Hydraulically operated, **pivots downwards**. During threading it is raised and extended to pass-line position and matched with the raised threading table on the deflector roll frame. Cylinders Ø50 × Ø28 × 600 (FPE236-3-724/R0) and Ø80 × Ø45 × 200 (FPE236-3-725/R0).

## 5.6 Deflector roll and threading table (entry & delivery)
*Drawings: EU 10 5 A1 (entry), EU 28 5 A1 (delivery)*

| Item | Value |
|---|---|
| Deflector roll | Single, **Ø300 × 600 barrel, alloy steel**, one each side |
| Mounting | Antifriction bearings in bearing blocks fixed to the entry/exit table frame |
| Bearings | Spherical roller Ø100 × Ø180 × 60.3, 23220CC/W33, SKF/FAG — 2 per side |
| **Instrumentation** | **Encoders on both operator side and drive side** for speed feedback and AGC |
| Entry table lift cylinder | Ø50 × Ø36 × 455 (CV 10 5 B1/R0) |
| Delivery table lift cylinder | Ø50 × Ø36 × 305 (CV 28 5 B1/R0) |

## 5.7 Crop shear at delivery
*Drawing: EU 28 4 A1*

| Item | Value |
|---|---|
| Type | **Down-cut**, hydraulically operated |
| Blade | Rectangular section — **all four edges usable** before regrinding |
| Top blade | Bolted to upper carrier at a rake angle |
| Bottom blade | Fixed, bolted to bottom blade holder set into the main frame, positioned below the pass line |
| Cylinder | Ø160 × Ø110 × 125 (CV 28 4 D3/R0) |
| Use | Leader and tail end normally not cut; used to square ends and after strip breakage |
| Safety | **Top knife holder to be locked during any work at the shear** |

## 5.8 Thickness gauge mounting (entry & delivery)
*Drawings: EU 10 3 A1 / EU 28 3 A1 (mounting), EU 10 8 A1 (entry gauge)*

- **Isotope non-contact** thickness gauge, one each at entry and delivery, identical construction.
- Protector fabricated by welding steel plates.
- Moved by hydraulic cylinder to the most backward position **at the drive side** for strip passing and maintenance; moved forward before rolling.
- Cylinder Ø50 × Ø36 × 600 (FPE236-3-280/R0) — 1 + 1.

## 5.9 Air knife wiper assembly (entry & delivery)
*Drawings: EU 10 2 A1 / EU 28 2 A1*

- Blows coolant off the strip at mill entry and delivery.
- Knives independently positioned by **turnbuckle**; raised/lowered by **pneumatic cylinder**.
- Cylinder: **102 bore × Ø25 rod × 100 stroke** (AG 10 2 E1), Schrader, 4 – 5 bar — 1 + 1.
- **Constant gap 0.1 – 0.3 mm to be maintained** — periodic check.

---

# 6. MILL STAND

## 6.1 Housing
*Drawing: EU 15 1 A1*

1. Operator-side and drive-side housings are made **separately**; each has a central window for inserting the rolls.
2. Both housings connected by a **separator at the top** and **back-up roll change rails at the bottom**.
3. **Replaceable steel plate liners** fitted to the inner faces of each housing window. When changing a liner, check for broken mounting bolts.
4. Mounted on the housing: Mae-west block, hydraulic roll force cylinder, pass-line adjusting device, chock clamp, spindle support assembly.

## 6.2 Roll force cylinder
*Drawings: EU 20 2 A1 (cylinder), EU 20 3 A1 (position transducer mounting)*

- **Ram type**, fitted with seals; **Ø420 × 45 mm stroke**.
- One at the **top of each housing** (OS and DS independently).
- **Linear detector** feeds cylinder pack movement to the electric control panel.
- **Air vent** provided; trapped air prevents smooth rolling. De-aerate by raising/lowering the piston repeatedly through ~40 mm near both ends until no bubbles remain.
- Working pressure 210 kg/cm² max, test 250 kg/cm².

## 6.3 Mae-west block
*Drawing: EU 19 1 A1*

1. Four blocks — installed at the **entry and delivery sides, on operator and drive sides**.
2. Each block contains a **work roll and back-up roll balance / bend cylinder**.
3. **There is an offset of 3 mm between back-up roll and work roll centres, obtained by making the entry-side and delivery-side block widths different.**
4. Faces contacting the work roll chock carry **replaceable steel plate liners**, changed along with work roll change and roll force operation.
5. **Work roll bending cylinders operate in co-operation with each other and apply an equal bending force to the upper and lower work rolls together.**
6. **Back-up balancing cylinders** press the top back-up roll against the **rocker plate** of the roll force cylinder, during both rolling and roll change.

## 6.4 Pass line adjustment

Steel shims of different thicknesses on a **trolley below the roll stack**. After roll grinding, pass line is corrected by adding or removing shims. The trolley is moved in and out of the mill by a hydraulic cylinder on the **drive side**.

## 6.5 Roll chocks

| Item | Detail |
|---|---|
| Construction | Cast steel, accurately machined, **replaceable bronze liners on sliding faces** |
| Back-up roll retention | Manually operated **clamp plates on the operator side** (EU 16 4 A1) |
| Work roll retention | **Held together by pins on the bottom work roll chock** — both WRs change as one stack |
| BUR chock drawing | EU 16 1 A1 |
| WR chock drawing | EU 17 1 A1 |

## 6.6 Back-up roll wipers
*Drawing: EU 13 3 A1*

Felt wipers on both top and bottom back-up rolls, fitted to a holder mounted on cross beams; cross beams bolted to the inner faces of the back-up chocks; **spring loaded** so they remain in constant contact with the rolls.

## 6.7 Mill drive
*Drawing: EU 22 0 A1*

| Element | Detail |
|---|---|
| Motor | DC, 750 kW, 0-350-710 rpm — Kirloskar KLDC 630-L |
| Coupling | **Full gear type with shear pins** (Renold) |
| Pinion stand | Welded steel casing, foundation mounted, **1:1 ratio**, FLENDER SPL 260-2 (EU 22 1 A1); gears and bearings on centralised lubrication |
| Spindles | **Gear tooth type** (Renold Ajax) — transmit rolling torque from main drive to work rolls |
| Spindle head support | EU 22 2 A1 — mounted on the housing at the **drive side**, **fixed type** (because both work rolls are at their lowest position during roll change); 2 × cylinders Ø50 × Ø36 × 80 (FPE236-3-885/R0) |

**Spindle service notes (Renold section):** lubricate **both ends** at least once a week; check lubricant level in the geared coupling monthly; dismantle and check tooth-surface wear at 3-month intervals; remove and inspect spindles at least once a year. Grease: Balmerol Alcon-3000 / Alithex-10 (Veedol).

## 6.8 Mill entry and delivery guides

**Pressure board (EU 13 5 A1)**

| Item | Detail |
|---|---|
| Function | Hold-down clamp; clamps the strip on first pass to give back tension and keeps the strip at pass-line centre |
| Boards | Top and bottom **hardwood boards** |
| Clamp actuation | **Link mechanism moved up/down by pneumatic cylinder** — Ø203 bore × Ø45 rod × 170 stroke (FPE236-3-381) |
| Lower clamp support | Pins in the operator- and drive-side housings |
| Retraction | Moved back by hydraulic cylinder Ø50 × Ø36 × 150 (FPE236-3-380/R0) at the entry end of the frame, for roll changing |
| Construction | Welded steel |

**Side guide (EU 13 5 A1)**

| Item | Detail |
|---|---|
| Type | **Vertical roller type** on antifriction bearings |
| Actuation | Opened/closed by **hydraulic motor Danfoss OMP-80** through screw & nut |
| Screw | Single shaft with **right-hand and left-hand threads** — both brackets move symmetrically |
| **Maximum opening** | **600 mm** |
| Bearings | Deep groove 6009 Ø30×Ø55×13 (8); Ø45×Ø75×16 (2) |

**Entry threading guide** — part of the bottom frame of the pressure board; installed between the pressure board and the work roll; retracted from the housing window for roll changing.

**Delivery threading guide (EU 26 2 A1)** — welded steel, installed between the delivery strip wiper and the work roll, supporting the strip to the deflector roll. Retracted from the housing window by hydraulic cylinder Ø50 × Ø36 × 150 (FPE236-3-299/R0) for roll change and maintenance. Carries the **coolant spray header**. Keep threading guides in the "SET" condition during all rolling and strip passing; adjust the gap between guide end and work roll; retract before roll change.

**Roll coolant header** — nozzle type; machined block with tappings for nozzles; supplies coolant to rolls and strip.

## 6.9 Roll changing device
*Drawing: EU 23 0 A1*

- Changing car: welded steel, mounted on **four wheels**, travelling on rails mounted on foundations, **traversed by hydraulic cylinder**.
- Cylinders: Ø100 × Ø70 × **2400** (CV 23 0 C1/R0) — 1 no; Ø63 × Ø36 × 100 (CV 23 0 C2/R0) — 4 nos.
- Bearings: spherical roller Ø60 × Ø130 × 31, 21312CC (4).
- Changes top and bottom **work roll assemblies together**.
- **Roll changing stool** used to rest the top back-up roll during BUR change.

**Work roll change sequence**
1. Retract the roll force cylinder; lift the top back-up roll with the balancing cylinders.
2. Lift all three rolls (stack) using the cylinders provided at the bottom.
3. Push out the trolley (which houses the pass-line adjusting shims).
4. Remove the shims and pull the trolley into the mill.
5. Rest the roll stack (bottom back-up and both work rolls).
6. Push the rolls out of the mill.
7. Lift both work rolls off.
8. Rest new work rolls on the bottom back-up roll.
9. Pull the rolls into the mill.
10. Replace pass-line adjusting shims following steps in reverse.

**Back-up roll change sequence**
1. Follow work-roll steps 1 to 7.
2. Place the roll changing stool on the bottom back-up roll.
3. Pull the trolley into the mill.
4. Rest the top back-up roll on the stool.
5. Push both back-up rolls out.
6. Reverse the sequence for new rolls.
7. Replace pass-line adjusting shims.

## 6.10 Mill enclosure and fume containment

- **Mill enclosure with front shutter (EU 15 4 A1)** — at the side of the mill to prevent fume escaping during rolling. Shutter closed during rolling, opened for maintenance and roll change. **Shutter is manually operated.**
- **Hood (EU 15 5 A1)** — provided on either side of the mill to discharge fume outside the mill.
- **Oil catcher arrangement (EU 15 6 A1)**.
- **Mill platform (EU 15 3 A1)**.

---

# 7. TENSION REELS (ENTRY & DELIVERY)
*Drawings: EU 07 0/1/2 A1 (entry), EU 32 0/1/2 A1 (delivery)*

## 7.1 Mandrel data

| Item | Value |
|---|---|
| Type | **Overhung, 4 segments** |
| Collapsed Ø | 497 |
| Expanded Ø | 508 |
| Face width | 620 |
| Expansion/collapse | Hydraulic cylinder (**rotating**) |
| Cylinder bore | 400 |
| Cylinder stroke | 45 (CV 07 2 D2/R0 — Ø400 × Ø180 × 45), 1 + 1 |
| Drive motor | 500 kW, 0-438-1350 rpm |
| Gear reduction | 4.3333 : 1 |
| Max coiling tension | 6900 kg up to 350 mpm |
| Coil OD | 1900 max |
| Gearbox bearings | 22232CC/W33 Ø160×Ø290×80 (4); 23068CC/W33 Ø340×Ø520×133 (2); 23080CAC/W33 Ø400×Ø600×148 (2) |

## 7.2 Construction

1. Reels installed on the entry and delivery sides of the mill; wind the strip continuously into coil form while applying tension.
2. Drum is expanded/collapsed by actuating the drum shaft (pyramid shaft) with the rotating cylinder.
3. A **hollow sleeve** (through which the drum shaft passes) is fitted with the **bull gear and bearings** and is part of the gearbox.
4. The **rotating cylinder is connected directly to the end of the drum shaft**; its action gives the drum shaft a **reciprocating axial motion**.
5. The coil-winding side of the drum shaft has a **pyramid pattern, 4-face configuration**; on its outside, **4 drum segments are retained through a key**. Axial motion of the drum shaft expands/collapses the segments. As the hollow sleeve rotates, the drum shaft rotates **through the splined part**.
6. A **strip gripper** is provided in one segment. The moving jaw is actuated by **single-acting hydraulic cylinders built into the segment**, closing at the time of expansion; the jaw **opens by springs** provided in the gripper segment.
7. **Bronze liners** provided on the sliding surfaces between drum shaft (pyramid) and segments. Torque is transmitted between the hollow shaft and the drum shaft through the splined part; grease is supplied to the splined part through a grease nipple on the retainer at the drum neck.

## 7.3 Pusher / stripper plate

Mounted on the tension reel gearbox. Comprises a plate fitted with **two guide rods moving in bronze bushes** housed in blocks fixed on top of the gearbox. Movement by hydraulic cylinder **Ø100 × Ø70 × 680** (FPE408-3-203/R2). Strips the coil off the mandrel after rolling.

## 7.4 Operating rules (from the manual)

| Rule | Detail |
|---|---|
| Warm-up | Operate the oil system before operating the reel; sufficient warming-up required |
| No-load idling | When idling continuously with no coil, **fit a ring to the drum and keep the drum open** — prevents segments springing out under centrifugal force |
| Tension application | **Tension must not be applied until at least one full wrap has been made.** Applying tension too soon pulls the gripper wedge away from the shaft and can damage gripper components |
| Start of winding | Wind 2 turns at jogging speed before applying tension |
| Spool loading | Verify no slippage drum→spool and spool→strip |
| Seizure | On seizure, switch drum operation to STOP immediately and stop rolling |
| Segment seizure with hot coil | If segments seize and normal collapse is not possible, **unwind the coil to another drum before it cools** — shrinkage on cooling creates crushing force that will damage segments and drum shaft |
| Excessive tension | Will break the drum — set tension per strip thickness, width and grade |
| Run-out check | Periodically, fit a ring, run no-load idling, measure run-out at the ring OD. Heavy run-out gives non-uniform strip tension and reduced accuracy; if not repaired the bend worsens progressively until repair is impossible |
| Gripper travel | Check grippers for unrestricted travel; if they do not open and close freely, dismantle and check hydraulic pistons for binding; replace piston seals if hydraulic leaks occur |
| Rotating cylinder overhaul | Residual pressure must be lowered to 0 kg/cm² before overhaul; support the pipe screwed part of the rotary joint |
| Overhaul indicators | (a) oil leaks from the end of the hollow shaft; (b) drum expand/collapse becomes slow or stops |
| Seal replacement | Detach cylinder cover, remove piston; on reassembly tighten head plate to cylinder body with **LOCTITE** |
| Greasing | Grease from the outside-diameter direction; **never turn the reel drum while greasing** |
| Segment inspection | Approximately **twice a year**, remove all four segments; check sliding surfaces and shaft segments are smooth and not scored or polished; stone out any scoring; apply additional grease |
| Segment handling | Segments have a **tapped hole for a lifting bolt** on the outer circumference — use a lift for dismantling |
| Relief/reducing valves | Check set pressure **once a month** |
| Drum underside | The lower portion of the drum is the pit for the coil car — fabricate a temporary footing for maintenance |

---

# 8. COIL CAR WITH EXIT STORAGE SADDLE (ETR & DTR)
*Drawings: EU 02 1 A1 (coil car), EU 08 0 A1 (ETR), EU 33 0 A1 (DTR)*

Description, operation and maintenance identical to the coil car at pay-off (§5.1). One each at entry and delivery tension reel. **Coil cars must be in the retracted position during rolling.**

---

# 9. AUXILIARY SYSTEMS (Chapter 6)

## 9.1 Roll coolant system

| Item | Value |
|---|---|
| Rolling oil type | Water / soluble oil mixture |
| Filter | **Paper media** |
| Coolant flow | **1200 LPM** |
| Supplier | Shop Aid Manufacturers Pvt. Ltd., Pune |
| Supply pumps | Centrifugal |
| Working pressure | ≈ 7 kg/cm² |
| Supply to filter | By gravity from the mill catchment tray through pipes |

**Flow path:** mill catchment tray → gravity → dirty oil tank → overflow → **paper band filter conveyor** (above the clean oil tank) → clean oil tank → pumped to spray nozzles at the mill. A **magnetic separator** removes iron particles before the paper filter. Used filter paper discharges to a bin adjacent to the filter tank. A **heat exchanger** feeds coolant to the mill at constant temperature.

*Plant fluid in service on CRM04: Bamerol Aquarol 411B (pH 6.0–8.0, conc 2.50–6.00 %, Fe ≤100 mg/L, Cl ≤150 ppm).*

## 9.2 Drive lubrication

| Item | Value |
|---|---|
| Type | One circulating oil system |
| Serves | Flattener pinion stand, entry & delivery tension reel gearboxes, mill pinion stand |
| Oil | SP 320 |
| System capacity | 180 LPM |
| Supplier | Shaan Lube Equipment Pvt. Ltd., Mumbai |
| Components | Reservoir, pumps, electric motor, filters, relief valves, control instruments, valves, pressure gauges, flow indicators |
| POR gearbox | **Separate localised lubrication pump, 40 LPM, 1.1 kW motor** |

Oil flow to be checked **each shift** via the flow meters.

## 9.3 Hydraulic systems — Mannesmann Rexroth (I) Ltd.

**A. High pressure — roll force cylinder and roll bending/balancing**
- One common **stainless steel tank** with level gauge, regulator and relief valves.
- **Two axial-piston, variable-volume, pressure-compensated pumps per system.**
- **Bladder type accumulators.**
- One heat exchanger.
- **Two manifold-mounted servo valves per system.**
- Gauges, filters etc. included.

**B. Low pressure — auxiliaries**
- One hydraulic system for the auxiliary equipment cylinders.
- Reservoir, pumping unit and valve stands; each valve stand carries directional control valves and other valves/instruments.

## 9.4 Fume exhaust system
*Drawing: EU 45 0 A1*

| Item | Value |
|---|---|
| Blower capacity | **40,000 m³/hr** |
| Motor rating | 50 HP |
| Drive | **V-belt** from AC motor, base frame with belt guard |
| Fan type | Centrifugal |
| Components | Mill hoods, ducting, discharge stack |
| Supplier | Ime Control Ltd. |

---

# 10. BOUGHT-OUT REGISTER (Chapter 11)

## 10.1 Hydraulic cylinders — Table I
Make: **VELJAN**. Working pressure 105 kg/cm² max, test 160 kg/cm² (except Sr. 19). Sr. 19: working 210 kg/cm² max, test 250 kg/cm².

| Sr | Assembly | Drawing | Part no. | Bore × Rod Ø × Stroke | Qty |
|---|---|---|---|---|---|
| 1 | Coil car — POR, ETR, DTR | EU 02 1 A1 | FPE414-3-1233/R0 | Ø160 × Ø90 × 800 | 1 each |
| 2 | Pay-off unit GA | EU 03 0 A1 | CV 03 0 D1/R0 | Ø160 × Ø90 × 150 | 1 |
| 3 | Pay-off mandrel | EU 03 2 A1 | CV 03 2 D1/R0 | Ø250 × Ø110 × 130 **(rotating)** | 1 |
| 4 | Snubber assembly | EU 03 3 A1 | CV 03 3 C1/R0 | Ø80 × Ø45 × 300 | 1 |
| 5 | Peeler unit | EU 05 1 A1 | FPE408-3-214/R0 | Ø50 × Ø28 × 580 | 1 |
| 5 | Peeler unit | EU 05 1 A1 | FPE408-3-215/R0 | Ø80 × Ø45 × 195 | 1 |
| 6 | Pinch roll cum flattener | EU 06 0 A1 | FPE236-3-663/R0 | Ø100 × Ø70 × 80 | 4 |
| 7 | Coupler shifting | EU 06 4 A1 | FPE236-3-690/R0 | Ø50 × Ø36 × 60 | 1 |
| 8 | Carry-over table | EU 06 5 A1 | FPE236-3-724/R0 | Ø50 × Ø28 × 600 | 1 |
| 8 | Carry-over table | EU 06 5 A1 | FPE236-3-725/R0 | Ø80 × Ø45 × 200 | 1 |
| 9 | Entry deflector roll & threading table | EU 10 5 A1 | CV 10 5 B1/R0 | Ø50 × Ø36 × 455 | 1 |
| 10 | Exit deflector roll & threading table | EU 28 5 A1 | CV 28 5 B1/R0 | Ø50 × Ø36 × 305 | 1 |
| 11 | Crop shear, exit side | EU 28 4 A1 | CV 28 4 D3/R0 | Ø160 × Ø110 × 125 | 1 |
| 12 | Gauge mounting, entry & exit | EU 10 3 / 28 3 A1 | FPE236-3-280/R0 | Ø50 × Ø36 × 600 | 1 + 1 |
| 13 | Side guide & pressure board | EU 13 5 A1 | FPE236-3-380/R0 | Ø50 × Ø36 × 150 | 1 |
| 14 | Spindle head support | EU 22 2 A1 | FPE236-3-885/R0 | Ø50 × Ø36 × 80 | 2 |
| 15 | Entry & exit table assembly | EU 26 2 A1 | FPE236-3-299/R0 | Ø50 × Ø36 × 150 | 1 |
| 16 | ETR & DTR drum assembly | EU 07 2 / 32 2 A1 | CV 07 2 D2/R0 | Ø400 × Ø180 × 45 **(rotating)** | 1 + 1 |
| 17 | ETR & DTR pusher plate | EU 07 2 / 32 2 A1 | FPE408-3-203/R2 | Ø100 × Ø70 × 680 | 1 |
| 18 | Roll change assembly | EU 23 0 A1 | CV 23 0 C1/R0 | Ø100 × Ø70 × 2400 | 1 |
| 18 | Roll change assembly | EU 23 0 A1 | CV 23 0 C2/R0 | Ø63 × Ø36 × 100 | 4 |
| **19** | **Roll force cylinder** | **EU 20 2 A1** | **EU 20 2 A1/R0** | **Ø420 × Ø380 × 45** | **1** |

## 10.2 Hydraulic motors — Table II

| Sr | Assembly | Drawing | Specification | Qty |
|---|---|---|---|---|
| 1 | Snubber roll | EU 03 3 A1 | **Danfoss OMP-315** | 1 |
| 2 | Coil car — POR / ETR / DTR | EU 02 1 A1 | **Danfoss OMP-315** | 1+1+1 |
| 3 | Side guide & pressure board | EU 13 5 A1 | **Danfoss OMP-80** | 1 |

## 10.3 Pneumatic cylinders — Table III
Make: **SCHRADER**. Working pressure 4 – 5 bar.

| Sr | Assembly | Drawing | Part no. | Bore × Rod Ø × Stroke | Qty |
|---|---|---|---|---|---|
| 1 | Air knife wiper, entry & exit | EU 10 2 / 28 2 A1 | AG 10 2 E1 | 102 × Ø25 × 100 | 1 + 1 |
| 2 | Side guide & pressure board | EU 13 5 A1 | FPE236-3-381 | Ø203 × Ø45 × 170 | 1 |

## 10.4 Bearings — Table IV

| # | Assembly | Description | Qty |
|---|---|---|---|
| 01 | Coil car (POR & coiler) EU 02 1 A1 | Spherical roller Ø80 × Ø140 × 33, 22216CC, SKF/FAG | 12 |
| 02 | POR gearbox EU 03 1 A1 | Spherical roller Ø170 × Ø200 × 62, 23124CC/W33 | 2 |
| 03 | POR gearbox | Spherical roller Ø140 × Ø225 × 68, 23128CC/W33 | 2 |
| 04 | POR gearbox | Spherical roller Ø230 × Ø340 × 90, 23044CC/W33 | 1 |
| 05 | POR gearbox | Spherical roller Ø260 × Ø400 × 104, 23052CC/W33 | 1 |
| 06 | Snubber roll EU 03 3 A1 | Flange cartridge MFC-40, RHP | 2 |
| 07 | Side guide EU 05 3 A1 | Deep groove Ø30 × Ø62 × 16, 6206-2Z | 2 |
| 08 | 5T jactuator EU 06 3 A1 | Single thrust ball Ø50 × Ø78 × 22, 51210 | 4 |
| 09 | 5T jactuator | Taper roller Ø20 × Ø47 × 15.25, 30204, SKF | 4 |
| 10 | Pinch roll cum flattener EU 06 1 A1 | Spherical roller Ø100 × Ø165 × 52, 23120CC/W33, SKF | 10 |
| 11 | Pinion stand EU 06 3 A1 | Spherical roller Ø80 × Ø140 × 33, 22216CC/W33, SKF | 10 |
| 12 | Pinion stand | Spherical roller Ø90 × Ø160 × 33, 22218CC/W33 | 2 |
| 13 | Coupler shifting EU 06 4 A1 | Cam follower NUKD-35, SKF/FAG | 2 |
| 14 | Entry side guide & pressure board EU 13 5 A1 | Deep groove Ø30 × Ø55 × 13, 6009 | 8 |
| 15 | Entry side guide & pressure board | Deep groove Ø45 × Ø75 × 16 | 2 |
| 16 | Exit deflector roll & threading table EU 28 5 A1 | Spherical roller Ø100 × Ø180 × 60.3, 23220CC/W33 | 2 |
| 17 | Entry deflector roll & threading table EU 10 5 A1 | Spherical roller Ø100 × Ø180 × 60.3, 23220CC/W33 | 2 |
| 18 | Roll change assembly EU 23 0 A1 | Spherical roller Ø60 × Ø130 × 31, 21312CC | 4 |
| **19** | **Work roll bearing scheme EU 17 1 A1** | **TIMKEN TQO — cone M224749 D, cup M224710 single, M224710 D double; Ø120.650 × Ø174.625 × 139.703 over cups / 141.288 over cover** | **4** |
| **20** | **BUR bearing scheme EU 16 1 A1** | **TIMKEN TQO — HM259049 DW, cup HM259010 D single, HM259010 CD double; Ø317.500 × Ø447.675 × 327.025** | **4** |
| 21 | ETR & DTR gearbox EU 07 1 / 32 1 A1 | Spherical roller Ø160 × Ø290 × 80, 22232CC/W33 | 4 |
| 22 | ETR & DTR gearbox | Spherical roller Ø340 × Ø520 × 133, 23068CC/W33 | 2 |
| 23 | ETR & DTR gearbox | Spherical roller Ø400 × Ø600 × 148, 23080CAC/W33 | 2 |
| 24 | Rear door EU 15 4 A1 | Single row deep groove Ø20 × Ø47 × 14, 6204, SKF | 4 |

## 10.5 Seals and other bought-outs

| Category | Detail |
|---|---|
| Rotary shaft seals | **Merkel Radiamatic** 4635, 1686, 1697 — for heavy-duty machines |
| Hydraulic/pneumatic seals | **Shamban** Turcon® / Turcite® — Stepseal, Glyd Ring, Dual Piston Ring, Excluder, Slydring, Zurcon |
| Rod seals | JANK series (e.g. JA11-014009-HPU, S09-1910030) |
| Air & hydraulic cylinders | Veljan, Hyderabad — with repair manual for air & hydraulic cylinders |
| DC brake | **Bhartia Cutler-Hammer** — DC magnetic brake, POR gearbox input |
| Spindles & couplings | **Renold Ajax** gear spindles; Renold forged steel geared couplings (Alignomatic) |
| Cable drag chains | Included (technical collaboration item) |
| Rolls | Union Electric, USA |

## 10.6 Recommended lubricants — Chapter 10

| Service | Grade |
|---|---|
| Hydraulic oil — LP system | **ENKLO 46 (HPCL)** |
| Hydraulic oil — HP system | **ENKLO HLP46 (HPCL)** |
| Rolling oil | SERVO CUT S (IOL) |
| Flushing oil | LUBREXFLUSH 22 (HPCL) |
| Gear oil | SERVOMESH 320 (IOL) / EPPARTHAN 320 (HPCL) |
| Grease — pyramid surface | **High temperature grease with 3 % molybdenum di-sulphide** |
| Grease — drive spindle | BALMEROL ALCON-3000 / ALITHEX-10 (VEEDOL) |
| Grease — other, incl. centralised points | SERVOGEM EP-2 (IOL) |

---

# 11. MAINTENANCE AND ROLL MANAGEMENT

## 11.1 Maintenance schedule — mill central area (Chapter 7)

| Spot | Operation | Frequency |
|---|---|---|
| Roll chock liners | Apply grease manually on liner or on Mae-west surface (whenever the assemblies are taken out of the mill) | On roll change |
| Drive spindles | Grease lubricated | Monthly |
| Work roll bearing | Grease packed lubrication | — |
| Back-up roll bearing | Grease packed lubrication | — |
| Housing liners | Manual grease lubrication through roll chocks | Weekly |

## 11.2 Maintenance schedule — pay-off reel with snubber roll

| Spot | Operation | Frequency |
|---|---|---|
| Pay-off gearbox | Centralised gear lube system | Continuous |
| Fix and sliding base frame | Grease lubricated | Weekly |
| Mandrel expanding segment | **Wedge liner lubricated with multipurpose grease** | Weekly |
| Snubber arm bush | 4 points grease | Weekly |
| Snubber flange cartridge bearing | 4 points grease | Weekly |
| Coupling | Grease lubricated | 6-monthly |

## 11.3 Maintenance schedule — entry & delivery tension reel with stripper plate

| Spot | Operation | Frequency |
|---|---|---|
| Gearbox | Centralised gear lube system | Continuous |
| Reverse pyramid mandrel — pyramid shaft wedge | Grease gun | Weekly |
| Reverse pyramid mandrel — pyramid shaft bush, front and rear | 2 grease nipples, grease gun | Weekly |
| Stripper plate — guide rod bushes | 4 points, grease gun | Weekly |
| Stripper guide & spring | Grease packing at 3 places | Monthly |
| Geared coupling, spacer type | Grease nipples, grease gun | Monthly |

## 11.4 Roll neck bearing regime

- **First bearing inspection: three months after commissioning.**
- Thereafter every **1500 hours of operation**: dismantle, wash, and **turn the external cones of the back-up roll bearings by 90°**.
- For uniform wear and load distribution, after every 1500 hours of rolling:
  - Change the load zone by 90°.
  - Interchange operator-side bottom back-up chock with drive-side bottom back-up chock.
- **Long standstill:** run the mill for a short period **every week** so an oil film can re-form in the bearing.
- On back-up roll change with oil-mist lubrication, check the oil level in the bearing casings so oil is available in the sump; refill if necessary.
- Every spacer-adjusted TQO bearing carries a **serial number**; all parts of that bearing must carry the same serial number. **Parts are not interchangeable.**

## 11.5 Roll grinding cycle (Chapter 8)

| Roll | Interval | Grind amount |
|---|---|---|
| **Back-up roll** | after ~**2000 – 2500 T** rolled | ≈ **1.0 mm on radius** |
| **Work roll** | after ~**100 – 120 T** rolled | **0.3 – 0.5 mm on radius** |

Work rolls **must** be ground if heat streaks are observed on the strip.

**Recommended grinding wheels:** back-up roll — A 60 J8 VN or A80, Grindwell Norton; work roll — A 60 J8 VN, Grindwell Norton.

## 11.6 Roll NDT methods specified

| Method | Application / limitation |
|---|---|
| Magnetic particle (MPT) | Surface and near-surface; **ferromagnetic material only**, limited to surface and close-to-surface defects |
| Liquid penetrant (LPT) | Surface-breaking defects; used to verify crack indications |
| Ultrasonic (UT) | Primarily internal defects; can also detect surface defects. Typical probe **4.0 MHz, 25 mm (1 in)** |
| Eddy current | **Surface defects only** — cannot penetrate beyond a few thousandths. Signal influenced by geometry, permeability, residual magnetism |

**Roll data card fields to record:** worn roll diameter; roll condition out of the mill; finish diameter after grinding; ground contour; amount of grind (calculated); reason for change.

## 11.7 Unscheduled roll change protocol

1. All incidents of **skidding and mill wrecks** to be noted by the mill operator and roll shop notified — even if the roll is not changed at the time.
2. On a severe mill accident with suspected roll damage: take the roll out and **immediately cover it with a heavy mat or place a steel "coffin" over it for at least 24 hours**. In extreme damage, leave the cover longer — rolls have been known to **fly apart** after severe damage. A crack can become "active" and cause catastrophic spalling; take care when moving the roll.
3. Remove any welded strip and evaluate damage severity.
4. Rough grind the roll.
5. **Eddy current test.** If a defect is found, continue rough grinding until removed. Verify any crack indication with **dye penetrant**.
6. Semi-finish grind, continuing to inspect with the tester.
7. Finish grind.
8. **Test the hardness at the barrel before use.**

---

# 12. OPERATING SEQUENCE (Chapter 4)

## 12.1 First pass — coil load and peel
1. Load packed, tightly square-wound coil onto the entry coil storage saddle by shop EOT crane.
2. Set pay-off reel in the **middle of edge position stroke** (mandrel C/L on mill C/L).
3. Collapse pay-off mandrel.
4. Load the coil with the coil car onto the pay-off mandrel — coil C/L as close to mandrel C/L as possible.
5. Lower coil car slightly.
6. Expand pay-off mandrel until the coil is fully gripped.
7. Lower snubber roll onto the coil.
8. Lower the coil car elevator completely.
9. Jog pay-off motor so the outer wrap end is in a suitable position for peeling.
10. Open pinch roll side guide; raise top pinch roll and top leveller roll.
11. Elevate coil peeler; extend so the knife enters underneath the coil end to cut the bands (adjust, elevate and/or rotate the coil to position before final cutting).
12. Remove band — **manual operation**.
13. Jog pay-off motor to feed the coil nose through to the leveller.
14. Operate snubber roll drive motor as required to assist feeding and prevent thrown loops.
15. Once the nose has passed through the leveller rolls, lower top pinch roll and leveller roll.

## 12.2 First pass — threading to mill
1. Lower coil car elevator (if raised) and traverse the coil car to skid position.
2. Retract coil peeler knife and lower; leveller roll flattens the coil nose.
3. Raise and extend the carry-over table; raise the entry-side threading apron.
4. Retract pay-off snubber roll.
5. Operate leveller and pay-off drives to feed the strip nose over the entry-side deflector roll.
6. Continue feeding through the mill, watching for snagging on wipers, guides and sprays.

## 12.3 First pass — mill setup
1. Set mill spray flow to zero.
2. Energise top back-up roll balancing cylinders and top work roll balancing cylinders.
3. Maintain mill pass line.
4. Set mill at preset gap for threading into the roll bite.
5. Open entry and exit side wipers.
6. Set side guides to fully open.
7. Retract thickness gauges.
8. Set mill side guides to correct width setting.
9. **Adjust work roll tilt to suit material shape.**
10. Jog mill drive to feed the strip nose over the exit-side deflector roll.
11. Exit-side shear cuts the bad end square with length.

## 12.4 First pass — DTR threading and rolling
1. Rotate exit tension reel drum to bring the gripper slot in line with the strip entry position.
2. Collapse exit tension reel drum and open the strip gripper.
3. Continue feeding with the threading apron, assisting manually, until the strip edge enters the gripper slot.
4. Close gripper and expand tension reel drum.
5. Disconnect leveller drive coupling.
6. Raise upper pinch roll and leveller roll (or adjust, depending on strip condition).
7. Retract the carry-over table and threading apron.
8. Jog mill drive to take up **2 turns** on the exit tension reel.
9. Close the pressure board.
10. Close entry and exit side mill wipers.
11. Reset the coolant spray flow.
12. Establish entry and exit side tension at rolling values.
13. Bring exit side thickness gauge into position.
14. Start rolling the first (pay-off) pass; set tension gradually while raising speed.
15. Stop mill before the strip tail leaves the pay-off mandrel.

## 12.5 Tail transfer to ETR
1. Lower upper pinch roll and leveller roll.
2. Pull the strip tail carefully through the leveller using mill drive inching; stop when the tail leaves the end of the carry-over table.
3. Reduce coolant spray flow to zero; lower the carry-over table to parking.
4. Jog mill left-to-right to feed the tail back over the entry-side deflector roll.
5. Entry-side shear cuts the bad tail end square with length.
6. Rotate entry-side tension reel drum to bring the gripper slot in line.
7. Collapse entry-side tension reel drum and open gripper.
8. Feed the tail into the gripper slot by jogging the mill, with the threading apron and manual assistance.
9. Close gripper and expand entry tension reel drum.
10. Open pressure board and side guides.
11. Jog mill to take 2 turns on the entry tension reel drum.
12. Readjust mill load and start coolant spray flow.
13. Establish entry and exit strip tension at rolling values.
14. Bring entry-side thickness gauge into position. Mill is ready for the second pass.

## 12.6 Normal rolling
Continue rolling for second and later passes. **The loading of the next coil onto the pay-off reel and its threading to the leveller can be carried out during this time.**

## 12.7 After last pass — coil strip-off
1. At the end of the last pass, slow to thread speed and stop before the coil end leaves the tension reel drum.
2. Retract thickness gauges.
3. Open screw-down.
4. Reduce coolant spray flow to zero.
5. Open entry and exit side wipers.
6. Traverse coil car into position underneath the coil; raise coil car elevator to snub the coil.
7. Open gripper of the tension reel drum.
8. Jog tension reel drive to pull the tail through and wind it on the coil to complete formation; **stop when the gripper is opposite the strippers on the pusher plate**.
9. Band the coil.
10. Adjust coil car elevator so it just touches the coil.
11. Collapse tension reel drum and open gripper. The coil now rests on the coil car elevator with the drum centrally situated within the coil bore.
12. Operate the pusher plate to push the coil (with the coil car) to the end of the drum.
13. Retract pusher plate.
14. Traverse coil car to bring the coil to the exit coil storage saddle.
15. Lower coil car elevator to rest the coil on the storage saddle.
16. Remove the coil by shop EOT crane.

**Note:** the tension reel coil car must be in the **retracted position during rolling**.

---

# 13. DRAWING REGISTER (Chapter 12) — 56 main assembly drawings

| # | Drawing | Description |
|---|---|---|
| 01 | EU 01 1 A1 | G.A. 4-Hi Rev. Mill **Elevation** |
| 02 | EU 01 0 A1 | G.A. 4-Hi Rev. Mill **Plan** |
| 03 | EU 50 1 A1 | Foundation layout |
| 04 | EU 50 2 A1 | Cellar layout |
| 05 | EU 50 3 A1 | Trench layout |
| 06 | EU 03 0 A1 | G.A. of pay-off reel |
| 07 | EU 03 1 A1 | Pay-off reel gearbox assembly |
| 08 | EU 03 2 A1 | Pay-off reel drum assembly |
| 09 | EU 03 3 A1 | Snubber roll assembly |
| 10 | EU 02 0 A1 | G.A. of coil car at pay-off |
| 11 | EU 02 1 A1 | Coil car assy — pay-off, ETR & DTR |
| 12 | EU 05 1 A1 | Peeler table assembly |
| 13 | EU 05 3 A1 | Side guide assembly |
| 14 | EU 06 0 A1 | Pinch roll cum flattener unit G.A. |
| 15 | EU 06 1 A1 | Pinch roll cum flattener assembly |
| 16 | EU 06 2 A1 | 5T jactuator assembly |
| 17 | EU 06 3 A1 | Pinion stand assembly |
| 18 | EU 06 4 A1 | Coupler shifting assembly |
| 19 | EU 06 5 A1 | Carry-over table assembly |
| 20 | EU 07 0 A1 | G.A. of entry tension reel |
| 21 | EU 07 1 A1 | ETR gearbox assembly |
| 22 | EU 07 2 A1 | ETR drum assembly |
| 23 | EU 08 0 A1 | G.A. of coil car at ETR |
| 24 | EU 10 0 A1 | G.A. of entry equipment |
| 25 | EU 10 2 A1 | Entry air knife wiper assy |
| 26 | EU 10 3 A1 | Thickness gauge mtg. assy (entry) |
| 27 | EU 10 5 A1 | Entry threading table assy & deflector roll assembly |
| 28 | EU 10 8 A1 | Entry thickness gauge assy |
| 29 | EU 13 3 A1 | Exit back-up roll wiper |
| 30 | EU 13 5 A1 | Side guide & pressure board assy |
| 31 | EU 15 1 A1 | **Mill housing arrangement** |
| 32 | EU 15 3 A1 | Mill platform assembly |
| 33 | EU 15 4 A1 | Mill enclosure assembly |
| 34 | EU 15 5 A1 | Hood assembly |
| 35 | EU 15 6 A1 | Oil catcher arrangement |
| 36 | EU 16 1 A1 | **Back-up roll chock assembly** |
| 37 | EU 16 4 A1 | Back-up chock clamp arrangement |
| 38 | EU 17 1 A1 | **Work roll chock assembly** |
| 39 | EU 19 1 A1 | **Mae-west block assembly** |
| 40 | EU 20 2 A1 | **Roll force cylinder assembly** |
| 41 | EU 20 3 A1 | Position transducer mounting arrgt |
| 42 | EU 22 0 A1 | **Mill drive arrangement** |
| 43 | EU 22 1 A1 | Mill drive pinion stand assy |
| 44 | EU 22 2 A1 | Spindle head support assembly |
| 45 | EU 23 0 A1 | Roll change assembly |
| 46 | EU 26 2 A1 | Delivery threading guide assy (coolant spray header) |
| 47 | EU 28 0 A1 | G.A. of delivery equipment |
| 48 | EU 28 2 A1 | Air knife wiper assy — delivery side |
| 49 | EU 28 3 A1 | Exit thickness gauge mtg. assy |
| 50 | EU 28 4 A1 | Exit crop shear assembly |
| 51 | EU 28 5 A1 | Exit threading table assy and deflector roll assembly |
| 52 | EU 32 0 A1 | G.A. of exit tension reel |
| 53 | EU 32 1 A1 | DTR gearbox assembly |
| 54 | EU 32 2 A1 | DTR drum assembly |
| 55 | EU 33 0 A1 | G.A. of coil car at DTR |
| 56 | EU 45 0 A1 | Fume exhaust system |

**Vendor catalogues bound into the manual:** Timken TQO tapered roller bearings (maintenance for operators); Merkel Radiamatic rotary shaft seals; Shamban sealing systems (Turcon/Turcite — Stepseal, Glyd Ring, Slydring, Excluder); Veljan air & hydraulic cylinder repair manual; Bhartia Cutler-Hammer DC brake; Renold Ajax gear spindle design, operation and maintenance; Renold forged steel geared couplings; Danfoss OMP hydraulic motors; cable drag chains.

---

# 14. GAPS, DISCREPANCIES AND ITEMS TO VERIFY

| # | Item | Status |
|---|---|---|
| 1 | **Centre-line spacings** POR – pinch roll – ETR – entry deflector – mill – delivery deflector – DTR | Dimensioned on EU 01 1 A1 but **not legible in the scan**. Must be measured off the original drawing. Ordering is confirmed; magnitudes are not. |
| 2 | **Pass-line elevation** and mill housing window dimensions | Not stated in text — take from EU 01 1 A1 and EU 15 1 A1 |
| 3 | **Coil car lift height** | Spec line degraded in the source. Travel 3400 and cylinder stroke 800 are confirmed; lift height is not |
| 4 | **Incoming coil OD** | Spec line garbled in the source ("Set max. (20 kg/mm max.)"). Outgoing OD 1900 max is confirmed |
| 5 | **Crop shear quantity** | Chapter 2 lists **one** shear at delivery. Chapter 5 Item 7 heading says **"Two numbers"**. The drawing register lists only EU 28 4 A1 (exit crop shear). However §12.5 step 5 requires an **entry-side** cut. Resolve against the plant |
| 6 | **Chapter 5 Item 7 reference drawing** printed as EU 28 5 A1 | Typo — EU 28 5 A1 is the exit threading table. The shear is **EU 28 4 A1** |
| 7 | **Mae-west 3 mm offset direction** | Manual states the offset exists and how it is produced (entry/delivery block width difference) but not its **sign** relative to first-pass direction |
| 8 | **Roll force cylinder designation** | Chapter 1: Ø420 × 45 stroke. Table I: Ø420 × Ø380 × 45. Ram type — confirm the effective area used in force calculation |
| 9 | **AGC and Mill Management System** | Listed in Chapter 2 as supplied items; **no mechanical drawing in the register**. Sensors are the deflector-roll encoders (OS + DS), roll force cylinder linear detectors (EU 20 3 A1) and the entry/exit isotope gauges |
| 10 | **Snubber roll drawing reference** | Chapter 5 §2 lists EU 03 3 A1 as "Pay-off snubber assembly"; drawing register lists EU 03 3 A1 as "Snubber roll assembly" — consistent |
| 11 | **Live-plant deviation from nominal** | Standing condition on Mill 4: back-up roll barrel taper (DS > OS) with associated −9 T AGC force reference. Nominal BUR profile in this document is the manual's, not the measured roll |

---

*Compiled from the FPE CRM04 Operation & Maintenance Manual. Values marked in §14 require confirmation against original drawings before use in design, procurement or model work.*
