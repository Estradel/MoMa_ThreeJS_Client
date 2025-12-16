export async function sendGetRequest(url: string): Promise<any> {
    let response = await fetch(url, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json"
        },
    });

    return await response.json();
}

export async function sendPostRequest(url: string, body: string): Promise<any> {
    let response = await fetch(url, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: body,
    });

    return await response.json();
}

export async function sendDeleteRequest(url: string): Promise<any> {
    let response = await fetch(url, {
        method: 'DELETE',
        headers: {
            "Content-Type": "application/json"
        },
    });

    return await response.json();
}