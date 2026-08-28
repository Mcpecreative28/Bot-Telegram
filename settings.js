module.exports = {
    TOKEN: '8639091008:AAEVj18M75AjYs5iu1nZcIK_eIBTclmrhDY',
    GROUP_ID: '-1004412942321', // ID Grup Utama
    ID_KYNO: "8575872550", 
    ID_TEMAN: "7459692708", 

    // Pengaturan Panel Server 1
    DOMAIN1: 'https://pterodactyl-free.hostkita.help',
    PLTA1: 'ptla_Mcqe1gkBFMNxjmEiEC9pxueEb54UVKNIQnKaaWI1hbj',
    PLTC1: 'ptlc_iB7IXHSjs6Lkx4SSH3RiGxsB7p4J3Xhl9kbdGl3hnxW',
    LOC1: 1,

    // Pengaturan Panel Server 2
    DOMAIN2: '',
    PLTA2: '',
    PLTC2: '',
    LOC2: 1,

    // Pengaturan Panel Server 3 (Jika kosong biarkan ISI_DOMAIN)
    DOMAIN3: '',
    PLTA3: '',
    PLTC3: '',
    LOC3: 1,

    // ==========================================
    // SETTING PROXY (UNTUK BYPASS REGION BLOCK)
    // Cari IP Proxy Indonesia (HTTP) di internet
    // Kosongkan jika tidak memakai proxy
    // ==========================================
    PROXY_HOST: '', // Contoh: '103.144.174.45'
    PROXY_PORT: '', // Contoh: '8080'

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