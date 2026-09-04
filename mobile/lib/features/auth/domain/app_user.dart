class AppUser {
  const AppUser({
    required this.id,
    required this.names,
    required this.surnames,
    required this.email,
    required this.status,
    required this.roles,
    required this.permissions,
    this.phone,
    this.ci,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id_usuario'] as int,
    names: json['nombres'] as String,
    surnames: json['apellidos'] as String,
    email: json['correo'] as String,
    phone: json['telefono'] as String?,
    ci: json['ci'] as String?,
    status: json['estado'] as String,
    roles: List<String>.from(json['roles'] as List? ?? const []),
    permissions: List<String>.from(json['permisos'] as List? ?? const []),
  );

  final int id;
  final String names;
  final String surnames;
  final String email;
  final String? phone;
  final String? ci;
  final String status;
  final List<String> roles;
  final List<String> permissions;

  String get fullName => '$names $surnames';
}
