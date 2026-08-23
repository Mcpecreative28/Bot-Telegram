module.exports = {
    TOKEN: '8975651955:AAH_5Ump6UBdl2TDeJDHN3gMcmFuuG0tJGc',
    GROUP_ID: '-1004412942321', // ID Grup Utama
    ID_KYNO: "8575872550", 
    ID_TEMAN: "7459692708", 

    // Pengaturan Panel Server 1
    DOMAIN1: 'https://20august-krstorees-premium.rzhosts.my.id',
    PLTA1: 'rtla_58NCtmPNJtolBbkCNly9qUopdoZlRUYXprKuHl1ZJPM',
    PLTC1: 'rtlc_ZRWhj6LwZzuOKCTPeuVVkZ1kbv9oH1ji1ehE5FIvAwV',
    LOC1: 1,

    // Pengaturan Panel Server 2 (Bot kini akan auto-tambah https://)
    DOMAIN2: '20august-krstore-premiumv2.pterocloud.my.id',
    PLTA2: 'rtla_Driyg6VeCxBmtI3EDSRnxh4CChn65vSNcwYyzCouMlV',
    PLTC2: 'rtlc_X5vZbHLTw4FzWUN9iTXosEd8gMxgmzgMH7JdexduGLx',
    LOC2: 1,

    // Pengaturan Panel Server 3 (Jika kosong biarkan ISI_DOMAIN)
    DOMAIN3: 'ISI_DOMAIN_SERVER_3',
    PLTA3: 'ptla_server3',
    PLTC3: 'ptlc_server3',
    LOC3: 1,

    // ID Egg Berdasarkan Foto
    EGGS: {
        "nodejs": 15,
        "python": 16,
        "nodejs_v2": 17,
        "golang": 20
    },

    MENU_MEDIA: 'https://c.termai.cc/i177/OoeE.jpg',

    roleHierarchy: [
        "USER", "RESS", "PREM", "ADP", "PT", "TK", 
        "CEO", "SECURITY", "SVIP", "DEV",          
        "PEMILIK", "CO-FOUNDER", "KING", "FOUNDER", "OWNER" 
    ],
    roleLimits: {
        "USER": 0, "RESS": 5, "PREM": 10, "ADP": 15, "PT": 20, "TK": 25,
        "CEO": 30, "SECURITY": 35, "SVIP": 40, "DEV": 45,
        "PEMILIK": 50, "CO-FOUNDER": 60, "KING": 100, 
        "FOUNDER": "UNLIMITED", "OWNER": "UNLIMITED"
    }
};