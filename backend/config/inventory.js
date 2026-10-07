// Physical room inventory: 6 flats x 3 rooms = 18 rooms.
// Mirrors frontend/src/data/kolamConfig.js (the two must be kept in sync).

const FLAT_IDS = ["1A", "1B", "2A", "2B", "3A", "3B"];

// Room id within every flat -> room type
const ROOM_TYPE_BY_ROOM_ID = {
  R1: "king",
  R2: "queen",
  R3: "twin",
};

const ROOM_KEYS = FLAT_IDS.flatMap((flatId) =>
  Object.keys(ROOM_TYPE_BY_ROOM_ID).map((roomId) => `${flatId}-${roomId}`)
);

const isValidFlatId = (flatId) => FLAT_IDS.includes(flatId);

const isValidRoomKey = (roomKey) => ROOM_KEYS.includes(roomKey);

const flatIdOfRoomKey = (roomKey) => roomKey.split("-")[0];

const roomTypeOfRoomKey = (roomKey) =>
  ROOM_TYPE_BY_ROOM_ID[roomKey.split("-")[1]];

module.exports = {
  FLAT_IDS,
  ROOM_KEYS,
  ROOM_TYPE_BY_ROOM_ID,
  isValidFlatId,
  isValidRoomKey,
  flatIdOfRoomKey,
  roomTypeOfRoomKey,
};
