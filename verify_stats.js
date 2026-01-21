const res = await fetch('http://localhost:8000/api/usage/stats?days=30');
const data = await res.json();
console.log('Stats:', data);

const usersRes = await fetch('http://localhost:8000/api/usage/users?days=30');
const usersData = await usersRes.json();
console.log('Users:', usersData);
