# Room Inventory

Unique room id format: `<flatId>-<roomId>` e.g. `1A-R1`. Property: `KOLAM_GANDHI`.

Every flat has: R1 = King (King bed), R2 = Queen (Queen bed), R3 = Twin (Twin beds).

```
Kolam Gandhi (KOLAM_GANDHI)
├── 1A → R1 King / R2 Queen / R3 Twin   (1A-R1, 1A-R2, 1A-R3)
├── 1B → R1 King / R2 Queen / R3 Twin   (1B-R1, 1B-R2, 1B-R3)
├── 2A → R1 King / R2 Queen / R3 Twin   (2A-R1, 2A-R2, 2A-R3)
├── 2B → R1 King / R2 Queen / R3 Twin   (2B-R1, 2B-R2, 2B-R3)
├── 3A → R1 King / R2 Queen / R3 Twin   (3A-R1, 3A-R2, 3A-R3)
└── 3B → R1 King / R2 Queen / R3 Twin   (3B-R1, 3B-R2, 3B-R3)
```

Total: 6 flats, 18 rooms. Each flat shares a Living Hall, Dining Area and Kitchen.

## Status values (front office)
`available`, `occupied`, `reserved`, `blocked` (maintenance/block). All rooms default to `available` in the static inventory because no booking/room-assignment data exists yet.

Source of truth in code: `frontend/src/data/kolamConfig.js`.
