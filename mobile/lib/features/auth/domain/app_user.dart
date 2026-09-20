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
    this.idSucursal,
    this.branchName,
    this.avatarUrl,
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
    idSucursal: json['id_sucursal'] as int?,
    branchName: json['sucursal'] as String?,
    avatarUrl: json['avatar_url'] as String?,
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
  final int? idSucursal;
  final String? branchName;
  final String? avatarUrl;

  AppUser copyWith({
    int? id,
    String? names,
    String? surnames,
    String? email,
    String? phone,
    String? ci,
    String? status,
    List<String>? roles,
    List<String>? permissions,
    int? idSucursal,
    String? branchName,
    String? avatarUrl,
    bool clearAvatar = false,
  }) => AppUser(
    id: id ?? this.id,
    names: names ?? this.names,
    surnames: surnames ?? this.surnames,
    email: email ?? this.email,
    phone: phone ?? this.phone,
    ci: ci ?? this.ci,
    status: status ?? this.status,
    roles: roles ?? this.roles,
    permissions: permissions ?? this.permissions,
    idSucursal: idSucursal ?? this.idSucursal,
    branchName: branchName ?? this.branchName,
    avatarUrl: clearAvatar ? null : (avatarUrl ?? this.avatarUrl),
  );

  Map<String, dynamic> toJson() => {
    'id_usuario': id,
    'nombres': names,
    'apellidos': surnames,
    'correo': email,
    'telefono': phone,
    'ci': ci,
    'estado': status,
    'roles': roles,
    'permisos': permissions,
    'id_sucursal': idSucursal,
    'sucursal': branchName,
    'avatar_url': avatarUrl,
  };

  String get fullName => '$names $surnames';

  bool get isAdmin =>
      roles.contains('ADMIN') || roles.contains('ADMINISTRADOR');

  bool get isStaff =>
      isAdmin ||
      roles.contains('ENCARGADO_SUCURSAL') ||
      roles.contains('CAJERO') ||
      roles.contains('AUXILIAR_INVENTARIO') ||
      permissions.any((p) => p.startsWith('inventario.') || p.startsWith('empleados.'));

  bool get hasBranchAssigned => idSucursal != null;
  bool get isBranchLocked => !isAdmin && hasBranchAssigned;
  String get assignedBranchLabel =>
      branchName ?? (idSucursal != null ? 'Sucursal #$idSucursal' : 'Todas las sucursales');

  String get roleName {
    if (isAdmin) return 'Administrador';
    if (roles.contains('ENCARGADO_SUCURSAL')) return 'Encargado de Sucursal';
    if (roles.contains('CAJERO')) return 'Cajero';
    if (roles.contains('AUXILIAR_INVENTARIO')) return 'Auxiliar de Inventario';
    if (roles.isNotEmpty && !roles.contains('CLIENTE')) return roles.first;
    return 'Cliente';
  }

  bool hasPermission(String permission) => permissions.contains(permission);
}
