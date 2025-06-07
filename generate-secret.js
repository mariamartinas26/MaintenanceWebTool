const crypto = require('crypto');
const secret = crypto.randomBytes(64).toString('hex');
console.log(secret);

//69a7f31147a202f50888708095e093086afe4c67178353b885ed9bb472162ac2e1be25eb16b7908f3b82eba949633ded474a0bb90be09832d166f7eb8380f5c1
