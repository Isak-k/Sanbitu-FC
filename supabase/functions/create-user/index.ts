import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "player" | "user";
  idToken: string; // Firebase ID token for verification
}

// Firebase Admin SDK helper functions
async function getFirebaseAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore",
  };

  // Base64url encode
  const base64url = (obj: any) => {
    const str = typeof obj === "string" ? obj : JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const unsignedToken = `${base64url(header)}.${base64url(payload)}`;

  // Import the private key and sign
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    }
  );

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<any> {
  // Verify token with Firebase
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${Deno.env.get("FIREBASE_API_KEY") || ""}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!response.ok) {
    throw new Error("Invalid ID token");
  }

  const data = await response.json();
  return data.users?.[0];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { email, password, full_name, role, idToken }: CreateUserRequest = await req.json();

    if (!email || !password || !full_name || !role || !idToken) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, full_name, role, idToken" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Firebase service account
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      console.error("FIREBASE_SERVICE_ACCOUNT not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      console.error("Failed to parse service account:", e);
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectId = serviceAccount.project_id;

    // Verify the requesting user's ID token
    let requestingUser;
    try {
      // Decode the ID token to get user info (simplified verification)
      const tokenParts = idToken.split(".");
      if (tokenParts.length !== 3) {
        throw new Error("Invalid token format");
      }
      const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/")));
      requestingUser = { uid: payload.user_id || payload.sub };
    } catch (e) {
      console.error("Token verification failed:", e);
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin in Firestore
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    
    const roleCheckUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/user_roles/${requestingUser.uid}`;
    const roleResponse = await fetch(roleCheckUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!roleResponse.ok) {
      console.error("User role not found or not admin");
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleDoc = await roleResponse.json();
    const userRole = roleDoc.fields?.role?.stringValue;

    if (userRole !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user with Firebase Identity Toolkit API
    const createUserUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;
    const createResponse = await fetch(createUserUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        displayName: full_name,
        emailVerified: true,
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error("Error creating user:", errorData);
      return new Response(
        JSON.stringify({ error: errorData.error?.message || "Failed to create user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserData = await createResponse.json();
    const newUserId = newUserData.localId;

    // Create user role in Firestore
    const roleDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/user_roles?documentId=${newUserId}`;
    const roleCreateResponse = await fetch(roleDocUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          role: { stringValue: role },
          user_id: { stringValue: newUserId },
          created_at: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    if (!roleCreateResponse.ok) {
      const roleError = await roleCreateResponse.json();
      console.error("Error creating role document:", roleError);
      // User was created but role assignment failed - still report success but log warning
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUserId,
          email: email,
          full_name,
          role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-user function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
