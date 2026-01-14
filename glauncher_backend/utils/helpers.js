const User = require('../models/User');

const update_user_role = async (user) => {
    let newRole = user.role;

    if (user.is_admin) {
        newRole = "Pico de Netherite";
    } else {
        const registrationDate = user.registration_date;
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - registrationDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const monthsSinceRegistration = diffDays / 30.44; // Average days in a month

        if (monthsSinceRegistration >= 8) {
            newRole = "Pico de Diamante";
        } else if (monthsSinceRegistration >= 5) {
            newRole = "Pico de Oro";
        } else if (monthsSinceRegistration >= 3) {
            newRole = "Pico de Hierro";
        } else if (monthsSinceRegistration >= 2) {
            newRole = "Pico de Piedra";
        } else {
            newRole = "Pico de madera";
        }
    }

    if (user.role !== newRole) {
        user.role = newRole;
        await user.save(); // Save the updated role to the database
    }
};

module.exports = { update_user_role };
