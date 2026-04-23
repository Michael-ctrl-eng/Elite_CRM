export async function createUser(email: string, name: string, password: string) {
    const response = await fetch('/api/auth/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
    }

    return await response.json();
}

export async function fetchUsers() {
    const response = await fetch('/api/auth/user');

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch users');
    }

    const data = await response.json();
    // Handle both array and {success, users} response formats
    const users = Array.isArray(data) ? data : (data.success ? data.users : []);
    return { success: true, users };
}

export async function deleteUsers(userIds: string[]) {
    const response = await fetch('/api/auth/user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete users');
    }

    return await response.json();
}
